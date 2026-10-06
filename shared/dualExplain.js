/**
 * Dual explanations: user-facing Hinglish + structured analyst/bank view.
 * Deterministic templates only. An LLM may rephrase user text later — never change the verdict.
 */

const USER_HEAD = {
  "High Risk": "Ye payment / message unsafe lag raha hai. Abhi mat pay karo.",
  Caution: "Thoda risky lag raha hai. Pehle verify karo, phir socho.",
  Safe: "Bada red flag nahi dikha. Phir bhi payee naam confirm karke pay karo.",
  BLOCK: "Payment rok diya gaya — ye pattern known scam se match karta hai.",
  WARNING: "Payment pe caution: kuch signals suspicious hain.",
  SAFE: "Payment safe dikh raha hai engines ke hisaab se.",
};

/**
 * Build dual explanation for message-analyze results.
 */
export function buildMessageDualExplain(result = {}) {
  const risk = result.risk || "Caution";
  const reasons = (result.reasons || []).slice(0, 4);
  const flags = result.red_flags || [];
  const coercion = result.coercion;
  const playbook = result.playbook;

  const userLines = [USER_HEAD[risk] || USER_HEAD.Caution];
  if (coercion?.coachingSuspected) userLines.push(coercion.interventionHi || coercion.interventionEn);
  if (playbook) userLines.push(playbook.youAreHereHi || playbook.youAreHere);
  for (const r of reasons.slice(0, 2)) userLines.push(String(r));

  const analyst = {
    verdict: risk,
    score: result.score,
    source: result.source || "rules",
    signals: [
      ...(result.score_breakdown
        ? [
            { id: "rules", label: "Rule engine", value: result.score_breakdown.rules },
            { id: "ml", label: "Text ML", value: result.score_breakdown.ml },
            { id: "final", label: "Final", value: result.score_breakdown.final },
          ]
        : [{ id: "score", label: "Risk score", value: result.score }]),
    ],
    ruleIds: flags,
    matchedTerms: result.matched_terms || [],
    ml: result.ml
      ? {
          probability: result.ml.scam_probability ?? result.ml.probability,
          category: result.ml.category?.label || result.ml.category,
          model: result.ml.model,
        }
      : null,
    coercionFlags: coercion?.flags?.map((f) => f.id) || [],
    playbookId: playbook?.playbookId || null,
    playbookStage: playbook ? playbook.stageIndex + 1 : null,
    weightsNote: result.score_breakdown?.mode || "rules_only",
    generatedBy: "template",
  };

  return {
    user: {
      headline: USER_HEAD[risk] || USER_HEAD.Caution,
      summary: userLines.filter(Boolean).join(" "),
      lines: userLines.filter(Boolean),
      language: "hinglish",
      generatedBy: "template",
    },
    analyst,
  };
}

/**
 * Build dual explanation for fraud-engine payment decisions.
 */
export function buildPaymentDualExplain(decision = {}) {
  const d = decision.decision || "WARNING";
  const userLines = [USER_HEAD[d] || USER_HEAD.WARNING];
  for (const line of (decision.explanation || []).slice(0, 3)) userLines.push(line);
  if (decision.playbook) userLines.push(decision.playbook.youAreHereHi || decision.playbook.youAreHere);

  const weights = decision.aggregation?.weights || {};
  const analyst = {
    verdict: d,
    riskLevel: decision.riskLevel,
    riskScore: decision.riskScore,
    signals: [
      { id: "ml", label: "ML model", value: decision.ml?.available ? decision.ml.score : null, weight: weights.ml },
      { id: "graph", label: "Graph engine", value: decision.graph?.score, weight: weights.graph },
      { id: "rules", label: "Rule engine", value: decision.rules?.score, weight: weights.rules },
    ],
    ruleIds: decision.rules?.triggeredRules || [],
    overrides: (decision.aggregation?.overridesApplied || []).map((o) => o.id),
    ml: decision.ml?.available
      ? {
          probability: decision.ml.probability,
          score: decision.ml.score,
          modelVersion: decision.ml.modelVersion,
          algorithm: decision.ml.algorithm,
          mock: Boolean(decision.ml.mock),
        }
      : { available: false, error: decision.ml?.error || "offline" },
    thresholds: decision.aggregation?.thresholds || null,
    weightedScore: decision.aggregation?.weightedScore,
    playbookId: decision.playbook?.playbookId || null,
    generatedBy: "template",
    note: "Verdict is produced by ML + graph + rules. An LLM may only rephrase user text; it never changes this decision.",
  };

  return {
    user: {
      headline: USER_HEAD[d] || USER_HEAD.WARNING,
      summary: userLines.filter(Boolean).join(" "),
      lines: userLines.filter(Boolean),
      language: "hinglish",
      generatedBy: decision.explanationSource || "template",
    },
    analyst,
  };
}

/** Optional LLM rephrase of user.summary only — caller must keep verdict/score untouched. */
export function applyUserRephrase(dual, rephrasedText) {
  if (!dual?.user || !rephrasedText) return dual;
  return {
    ...dual,
    user: {
      ...dual.user,
      summary: String(rephrasedText).trim(),
      generatedBy: "template+llm_rephrase",
    },
  };
}
