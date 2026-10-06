/**
 * Rule-based transaction risk used when the ML anomaly service is unreachable.
 * Mirrors the feature set of ml/features.py so both paths explain themselves alike.
 */
export function heuristicTxnRisk({
  amount = 0,
  user_avg = 1000,
  new_payee = false,
  hour = 12,
  velocity_1h = 0,
  payee_complaints = 0,
  collect_request = false,
} = {}) {
  const reasons = [];
  let score = 0;
  const ratio = amount / Math.max(user_avg, 1);

  if (ratio >= 10) {
    score += 35;
    reasons.push({ feature: "amount_ratio", text: "Amount is far above your usual payment size" });
  } else if (ratio >= 4) {
    score += 20;
    reasons.push({ feature: "amount_ratio", text: "Amount is well above your usual payment size" });
  }
  if (new_payee) {
    score += 15;
    reasons.push({ feature: "new_payee", text: "Payee is new / never paid before" });
  }
  if (hour >= 23 || hour <= 4) {
    score += 10;
    reasons.push({ feature: "night", text: "Payment is happening late at night" });
  }
  if (velocity_1h >= 3) {
    score += 10;
    reasons.push({ feature: "velocity_1h", text: "Many payments in the last hour" });
  }
  if (payee_complaints >= 20) {
    score += 40;
    reasons.push({ feature: "payee_complaints", text: "Payee has many community complaints" });
  } else if (payee_complaints >= 5) {
    score += 25;
    reasons.push({ feature: "payee_complaints", text: "Payee has community complaints" });
  } else if (payee_complaints >= 1) {
    score += 10;
    reasons.push({ feature: "payee_complaints", text: "Payee has been reported before" });
  }
  if (collect_request) {
    score += 20;
    reasons.push({ feature: "collect_request", text: "This is a collect request, not a normal send" });
  }

  score = Math.min(100, score);
  return {
    anomaly_score: score,
    level: score >= 70 ? "high" : score >= 40 ? "elevated" : "normal",
    reasons: reasons.slice(0, 4),
    model: "rule-heuristic",
  };
}
