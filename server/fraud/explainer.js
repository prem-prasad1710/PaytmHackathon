// Human-readable explanation. Pure template text built from the engines' own evidence.
// It never changes the decision. (An LLM could rephrase user text later; it is not required.)

import { buildPaymentDualExplain } from "../../shared/dualExplain.js";
import { detectPlaybook } from "../../shared/playbook.js";

const HEADLINE = {
  BLOCK: "Payment blocked",
  WARNING: "Payment needs your attention",
  SAFE: "Payment looks safe",
};

export function buildExplanation({ decision, riskLevel, riskScore, ml, graph, rules, aggregation, transaction, facts }) {
  const lines = [];

  for (const o of aggregation.overridesApplied) {
    if (o.id.startsWith("CONFIRMED")) lines.push(o.detail);
  }
  for (const r of rules.ruleDetails) lines.push(r.detail);
  for (const reason of graph.reasons) lines.push(reason);

  if (!ml.available) {
    lines.push("ML model unavailable: decision made by the rule and graph engines only");
  } else if (decision === "SAFE") {
    for (const f of (ml.protectiveFactors || []).slice(0, 2)) lines.push(`Reassuring: ${f.text}`);
  } else {
    const material = ml.topFactors.filter((f) => f.impact !== "low");
    for (const f of material.slice(0, 3)) lines.push(`ML model: ${f.text}`);
  }

  const unique = [...new Set(lines)];
  const summary = `${HEADLINE[decision]} - risk ${riskScore}/100 (${riskLevel}). ${
    unique.length ? unique[0] : "No fraud indicators were found."
  }`;

  // Infer playbook from recipient + rule context when message text is absent
  const ctxText = [
    transaction?.recipientId || "",
    ...(rules.triggeredRules || []),
    facts?.complaints > 5 ? "high complaints refund kyc" : "",
    rules.triggeredRules?.includes("HIGH_VELOCITY") ? "mule rapid" : "",
  ].join(" ");
  const playbook = detectPlaybook(ctxText, {
    collect: Boolean(transaction?.collect),
  });

  const partial = {
    decision,
    riskLevel,
    riskScore,
    ml,
    graph,
    rules: { triggeredRules: rules.triggeredRules || rules.triggeredRules, ...rules },
    aggregation,
    explanation: unique.length ? unique : ["No fraud indicators were found"],
    explanationSource: "template",
    playbook: playbook || undefined,
  };
  const dual = buildPaymentDualExplain(partial);

  return {
    summary,
    explanation: unique.length ? unique : ["No fraud indicators were found"],
    generatedBy: "template",
    playbook: playbook || undefined,
    dual,
  };
}
