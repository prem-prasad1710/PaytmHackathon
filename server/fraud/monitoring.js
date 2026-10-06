// Prediction monitoring (Node side): counts and latency of every decision, derived only from
// real evaluations. The Python service tracks the model's own inference latency separately.

const WINDOW = 500;

export class FraudMonitoring {
  constructor() {
    this.reset();
  }

  reset() {
    this.predictionCount = 0;
    this.fraudPredictionCount = 0;
    this.mlUnavailableCount = 0;
    this.scoreSum = 0;
    this.highRiskCount = 0;
    this.decisions = { SAFE: 0, WARNING: 0, BLOCK: 0 };
    this.modelLatency = [];
    this.endToEndLatency = [];
    this.since = new Date().toISOString();
  }

  record(decision) {
    this.predictionCount += 1;
    this.scoreSum += decision.riskScore;
    this.decisions[decision.decision] += 1;
    if (decision.decision === "BLOCK") this.fraudPredictionCount += 1;
    if (decision.riskScore >= 70) this.highRiskCount += 1;
    if (!decision.mlAvailable) this.mlUnavailableCount += 1;
    if (decision.ml.available && typeof decision.ml.latencyMs === "number") this.#push(this.modelLatency, decision.ml.latencyMs);
    this.#push(this.endToEndLatency, decision.latencyMs);
  }

  #push(list, v) {
    list.push(v);
    if (list.length > WINDOW) list.shift();
  }

  static #pct(list, p) {
    if (!list.length) return null;
    const s = [...list].sort((a, b) => a - b);
    return Number(s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2));
  }

  snapshot() {
    const n = this.predictionCount;
    const avg = (l) => (l.length ? Number((l.reduce((a, b) => a + b, 0) / l.length).toFixed(2)) : null);
    return {
      since: this.since,
      prediction_count: n,
      fraud_prediction_count: this.fraudPredictionCount,
      average_risk_score: n ? Number((this.scoreSum / n).toFixed(1)) : null,
      high_risk_rate: n ? Number((this.highRiskCount / n).toFixed(4)) : null,
      ml_unavailable_count: this.mlUnavailableCount,
      decisions: { ...this.decisions },
      model_latency_ms: { mean: avg(this.modelLatency), p95: FraudMonitoring.#pct(this.modelLatency, 0.95), samples: this.modelLatency.length },
      end_to_end_latency_ms: { mean: avg(this.endToEndLatency), p95: FraudMonitoring.#pct(this.endToEndLatency, 0.95) },
    };
  }
}
