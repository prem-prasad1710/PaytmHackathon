const base = () => String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const TEXT = {
  amount_ratio: "Amount is far above your usual payment size",
  new_payee: "Payee is new / never paid before",
  night: "Payment is happening late at night",
  velocity_1h: "Many payments in the last hour",
  payee_complaints: "Payee has community complaints",
  collect_request: "This is a collect request, not a normal send",
};

function localRisk(ctx, complaints = 0) {
  const ratio = ctx.amount / Math.max(ctx.user_avg || 800, 1);
  const hits = [];
  let score = 5;
  if (ratio >= 8) { score += 30; hits.push("amount_ratio"); }
  else if (ratio >= 4) { score += 18; hits.push("amount_ratio"); }
  if (ctx.new_payee) { score += 15; hits.push("new_payee"); }
  if (ctx.hour >= 23 || ctx.hour <= 4) { score += 12; hits.push("night"); }
  if (ctx.velocity_1h >= 3) { score += 12; hits.push("velocity_1h"); }
  if (complaints > 0) { score += Math.min(35, 12 + complaints); hits.push("payee_complaints"); }
  if (ctx.collect_request) { score += 18; hits.push("collect_request"); }
  score = Math.min(100, score);
  return {
    anomaly_score: score,
    level: score >= 70 ? "high" : score >= 40 ? "elevated" : "normal",
    reasons: hits.map((f) => ({ feature: f, text: TEXT[f] })),
    model: "on-device-heuristic",
    payee_complaints: complaints,
  };
}

export async function fetchTransactionRisk(ctx) {
  try {
    const res = await fetch(`${base()}/api/transaction-risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return localRisk(ctx);
  }
}

export async function fetchModelMetrics() {
  const res = await fetch(`${base()}/api/ml/metrics`);
  if (!res.ok) throw new Error("ML service offline");
  return res.json();
}
