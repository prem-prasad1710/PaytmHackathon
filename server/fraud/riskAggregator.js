// Risk aggregator: combines ML + graph + rules into one 0-100 score and a payment decision.
// The LLM is never involved here; it can only explain a decision after the fact.

export const LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function normalizeWeights({ mlWeight, graphWeight, ruleWeight }, mlAvailable = true) {
  const raw = { ml: mlAvailable ? Math.max(0, mlWeight) : 0, graph: Math.max(0, graphWeight), rules: Math.max(0, ruleWeight) };
  const total = raw.ml + raw.graph + raw.rules || 1;
  return { ml: raw.ml / total, graph: raw.graph / total, rules: raw.rules / total };
}

function levelFor(score, thresholds) {
  if (score >= thresholds.critical) return "CRITICAL";
  if (score >= thresholds.block - 15) return "HIGH";
  if (score >= thresholds.warning) return "MEDIUM";
  return "LOW";
}

function decisionFor(score, level, thresholds) {
  if (level === "CRITICAL" || score >= thresholds.block) return "BLOCK";
  if (score >= thresholds.warning) return "WARNING";
  return "SAFE";
}

/**
 * @param {{ml: {available:boolean, score?:number}, graph:{score:number}, rules:{score:number}, facts:object, graphDetail:object}} input
 * @param {{weights:object, thresholds:object, overrides:object}} config
 */
export function aggregateRisk({ ml, graph, rules, facts, graphDetail }, config) {
  const mlAvailable = Boolean(ml?.available);
  const mlScore = mlAvailable ? ml.score : 0;
  const w = normalizeWeights(config.weights, mlAvailable);
  const weighted = mlScore * w.ml + graph.score * w.graph + rules.score * w.rules;

  let score = weighted;
  const applied = [];

  if (!mlAvailable) {
    const floor = 0.85 * Math.max(graph.score, rules.score);
    if (floor > score) {
      score = floor;
      applied.push({ id: "ML_UNAVAILABLE_EVIDENCE_FLOOR", detail: "ML unavailable: strongest independent signal is not diluted by averaging" });
    }
  }

  // The deterministic engines are auditable, so a strong signal from either must never be
  // averaged away by quiet ML. The floor only reaches WARNING; blocking needs more agreement.
  const alarm = Math.max(graph.score, rules.score);
  if (alarm >= config.alarmFloor.min) {
    const floor = config.alarmFloor.factor * alarm;
    if (floor > score) {
      score = floor;
      applied.push({ id: "STRONG_SIGNAL_FLOOR", detail: "A graph or rule signal is strong enough to require review even though the model is calm" });
    }
  }

  const strong = [mlAvailable ? mlScore : null, graph.score, rules.score].filter((s) => s !== null && s >= 75).sort((a, b) => b - a);
  if (strong.length >= 2) {
    const consensus = 0.9 * ((strong[0] + strong[1]) / 2);
    if (consensus > score) {
      score = consensus;
      applied.push({ id: "CONSENSUS_FLOOR", detail: "Two independent engines agree on very high risk" });
    }
  }

  let critical = false;
  if (facts.recipientBlocked) {
    score = 100;
    critical = true;
    applied.push({ id: "CONFIRMED_BLOCKED_RECIPIENT", detail: "Recipient is a confirmed blocked account; no model score can lower this" });
  }
  const confirmed = graphDetail.connectedBlocked;
  if (confirmed >= config.overrides.multipleConfirmedEntities && facts.payments5m >= config.overrides.extremeVelocity5m) {
    score = Math.max(score, 90);
    critical = true;
    applied.push({
      id: "CONFIRMED_NETWORK_EXTREME_VELOCITY",
      detail: `Connected to ${confirmed} confirmed scam entities and ${facts.payments5m} payments in 5 minutes`,
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const riskLevel = critical ? "CRITICAL" : levelFor(score, config.thresholds);
  const decision = critical ? "BLOCK" : decisionFor(score, riskLevel, config.thresholds);
  return { riskScore: score, riskLevel, decision, weights: w, weightedScore: Math.round(weighted), overridesApplied: applied };
}
