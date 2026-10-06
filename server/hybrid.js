import { normalizeResult } from "../shared/offlineEngine.js";

export const ML_URL = (process.env.ML_SERVICE_URL || process.env.ML_URL || "http://localhost:8001").replace(/\/$/, "");
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 2500);
const ML_ENABLED = String(process.env.ML_SERVICE_ENABLED ?? "true").toLowerCase() !== "false";

async function mlFetch(path, body) {
  if (!ML_ENABLED) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ML_TIMEOUT_MS);
  try {
    const res = await fetch(`${ML_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const mlPredict = (text) => mlFetch("/text/predict", { text });
export const mlTransaction = (payload) => mlFetch("/text/transaction", payload);
export const mlMetrics = () => mlFetch("/text/metrics");
export const mlHealth = async () => {
  const h = await mlFetch("/text/health");
  return h?.ok ? h : null;
};

const ML_CONFIDENT = Number(process.env.TEXT_ML_CONFIDENT || 92);

const riskFromScore = (s) => (s >= 70 ? "High Risk" : s >= 35 ? "Caution" : "Safe");

const RISK_COPY = {
  "High Risk": {
    recommended_action: "Payment mat karo. Link/QR/PIN ignore karo aur is sender ko report karo.",
    hindi_summary: "Shield ke multiple signals is message ko scam bata rahe hain. Aage mat badho.",
  },
  Caution: {
    recommended_action: "Pehle official source ya saved number se verify karo, phir hi pay karo.",
    hindi_summary: "Kuch signals suspicious hain. Verify karke hi aage badho.",
  },
  Safe: {
    recommended_action: "Koi bada scam signal nahi mila. Phir bhi payee naam check karke pay karo.",
    hindi_summary: "Ye message safe lag raha hai. Payee confirm karke pay kar sakte ho.",
  },
};

/**
 * Safety-first blend of the rule/LLM verdict with the ML probability.
 * - matched scenario: lean toward whichever signal is more alarmed
 * - no scenario matched: the ML model decides (rules have nothing to say)
 */
export function blendWithMl(base, ml) {
  if (!ml || typeof ml.scam_probability !== "number") {
    return {
      ...base,
      score_breakdown: { rules: base.score, ml: null, final: base.score, mode: "rules_only" },
    };
  }

  const unmatched = (base.red_flags || []).includes("unmatched_template");
  const ruleScore = base.score;
  const mlScore = Math.round(ml.scam_probability * 100);

  let final;
  let weights;
  if (unmatched) {
    weights = { rules: 0.15, ml: 0.85 };
    final = Math.round(ruleScore * weights.rules + mlScore * weights.ml);
  } else {
    const hi = Math.max(ruleScore, mlScore);
    const lo = Math.min(ruleScore, mlScore);
    weights = { rules: 0.5, ml: 0.5, note: "alarm-weighted (60% higher / 40% lower signal)" };
    final = Math.round(hi * 0.6 + lo * 0.4);
    // A matched keyword template must not talk a very confident model out of a block.
    if (mlScore >= ML_CONFIDENT && final < 70) final = 70;
  }
  final = Math.max(0, Math.min(100, final));

  const hasComplaint = Boolean(base.complaint_alert?.found);
  let risk = riskFromScore(final);
  if (hasComplaint && risk === "Safe") risk = "Caution";

  const mlReason = `ML model: ${mlScore}% scam probability${
    ml.category ? ` (${ml.category.label})` : ""
  }`;

  const riskChanged = risk !== base.risk;
  const copy = RISK_COPY[risk];

  const merged = normalizeResult({
    ...base,
    risk,
    score: final,
    safe_to_proceed: risk === "Safe" && !hasComplaint,
    reasons: [mlReason, ...(base.reasons || []).filter((r) => r !== "Need more context")].slice(0, 6),
    recommended_action: riskChanged ? copy.recommended_action : base.recommended_action,
    hindi_summary: riskChanged ? copy.hindi_summary : base.hindi_summary,
    red_flags: Array.from(
      new Set([
        ...(base.red_flags || []).filter((f) => !(risk === "Safe" && f === "unmatched_template")),
        ...(ml.category ? [ml.category.id] : []),
      ])
    ),
    suggested_ui: riskChanged ? undefined : base.suggested_ui,
  });

  return {
    ...base,
    ...merged,
    score_breakdown: {
      rules: ruleScore,
      ml: mlScore,
      final,
      weights,
      mode: unmatched ? "ml_led" : "blended",
      upgraded: riskChanged && final > ruleScore,
      downgraded: riskChanged && final < ruleScore,
    },
    ml: {
      probability: ml.scam_probability,
      label: ml.label,
      category: ml.category,
      category_confidence: ml.category_confidence,
      top_tokens: ml.top_tokens || [],
      safe_tokens: ml.safe_tokens || [],
      signals: ml.signals || [],
      model: ml.model,
    },
  };
}

const TXN_TEXT = {
  amount_ratio: "Amount is far above your usual payment size",
  new_payee: "Payee is new / never paid before",
  night: "Payment is happening late at night",
  velocity_1h: "Many payments in the last hour",
  payee_complaints: "Payee has community complaints",
  collect_request: "This is a collect request, not a normal send",
};

/** Rule-based stand-in used when the ML service is offline. */
export function heuristicTransactionRisk(p) {
  const ratio = p.amount / Math.max(p.user_avg || 1000, 1);
  const hits = [];
  let score = 5;
  if (ratio >= 8) { score += 30; hits.push("amount_ratio"); }
  else if (ratio >= 4) { score += 18; hits.push("amount_ratio"); }
  if (p.new_payee) { score += 15; hits.push("new_payee"); }
  if (p.hour >= 23 || p.hour <= 4) { score += 12; hits.push("night"); }
  if (p.velocity_1h >= 3) { score += 12; hits.push("velocity_1h"); }
  if (p.payee_complaints > 0) { score += Math.min(35, 12 + p.payee_complaints); hits.push("payee_complaints"); }
  if (p.collect_request) { score += 18; hits.push("collect_request"); }
  score = Math.min(100, score);
  return {
    anomaly_score: score,
    level: score >= 70 ? "high" : score >= 40 ? "elevated" : "normal",
    reasons: hits.map((f) => ({ feature: f, text: TXN_TEXT[f] })),
    model: "heuristic-fallback",
  };
}
