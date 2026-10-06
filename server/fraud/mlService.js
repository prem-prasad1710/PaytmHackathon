// FraudMLService: the single interface the payment engine uses to get an ML score.
//   PythonMLService - calls the FastAPI service that serves the trained XGBoost model.
//   MockMLService   - deterministic stand-in for tests / offline demos. It is a hand-written
//                     heuristic, labelled as such everywhere (mock: true), never a "model".
//   DisabledMLService - used when ML_SERVICE_ENABLED=false.
// All of them return { available: false } instead of throwing, so the rules + graph engines
// always keep protecting payments when ML is down.

const unavailable = (error) => ({ available: false, mock: false, error, score: null, probability: null, modelVersion: null });

export class DisabledMLService {
  name = "disabled";
  async health() {
    return { available: false, reason: "ML_SERVICE_ENABLED=false" };
  }
  async score() {
    return unavailable("ML service disabled");
  }
  async sync() {}
  async reset() {}
  async ingest() {}
  async warm() {}
  async get() {
    return null;
  }
}

export class PythonMLService {
  name = "python";

  constructor({ url, timeoutMs = 2500, retryAfterMs = 4000 }) {
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.retryAfterMs = retryAfterMs;
    this.downUntil = 0;
    this.synced = false;
    this.forceSync = true;
    this.ledger = null;
  }

  attachLedger(ledger) {
    this.ledger = ledger;
    this.synced = false;
  }

  async #call(path, body, timeoutMs = this.timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.url}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error(typeof data?.detail === "string" ? data.detail : `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async health() {
    try {
      const h = await this.#call("/health", undefined, 1200);
      return { available: Boolean(h.ok), ...h };
    } catch (e) {
      return { available: false, reason: e.name === "AbortError" ? "timeout" : e.message };
    }
  }

  /** Make the Python feature store identical to the Node ledger (needed after restarts / outages). */
  async sync() {
    if (!this.ledger) return;
    const state = await this.#call("/state");
    if (!this.forceSync && state.events === this.ledger.eventCount) {
      this.synced = true;
      return;
    }
    await this.#call("/state/reset", {});
    const events = this.ledger.events;
    for (let i = 0; i < events.length; i += 5000) {
      await this.#call("/ingest", { events: events.slice(i, i + 5000) }, 15000);
    }
    this.synced = true;
    this.forceSync = false;
  }

  async reset() {
    this.synced = false;
    this.forceSync = true;
  }

  async warm() {
    if (Date.now() < this.downUntil) return;
    try {
      await this.sync();
    } catch {
      this.downUntil = Date.now() + this.retryAfterMs;
    }
  }

  /** Mirror an applied ledger event into the Python feature store (no-op until synced). */
  async ingest(events) {
    if (!this.synced || Date.now() < this.downUntil) return;
    try {
      await this.#call("/ingest", { events });
    } catch {
      this.synced = false;
    }
  }

  /** Read-only passthrough used by the dashboard (metrics, importance, scam DNA...). */
  async get(path) {
    try {
      return await this.#call(path, undefined, 4000);
    } catch {
      return null;
    }
  }

  async score(tx) {
    if (Date.now() < this.downUntil) return unavailable("ML service unreachable (retrying shortly)");
    try {
      if (!this.synced) await this.sync();
      const out = await this.#call("/predict", {
        transaction: {
          transactionId: tx.transactionId,
          amount: tx.amount,
          senderId: tx.senderId,
          recipientId: tx.recipientId,
          deviceId: tx.deviceId,
          ipAddress: tx.ipAddress,
          timestamp: tx.ts,
        },
        commit: false,
      });
      if (out.ledgerEvents !== undefined && this.ledger && out.ledgerEvents !== this.ledger.eventCount) this.synced = false;
      return {
        available: true,
        mock: false,
        score: out.riskScore,
        probability: out.fraudProbability,
        isFraudPrediction: out.isFraudPrediction,
        threshold: out.threshold,
        modelVersion: out.modelVersion,
        algorithm: out.algorithm,
        topFactors: out.topFactors || [],
        protectiveFactors: out.protectiveFactors || [],
        scamDna: out.scamDna || null,
        features: out.features || {},
        latencyMs: out.latencyMs,
      };
    } catch (e) {
      this.synced = false;
      if (e.status === 422) return unavailable(`ML rejected the transaction: ${e.message}`);
      this.downUntil = Date.now() + this.retryAfterMs;
      return unavailable(e.name === "AbortError" ? "ML service timed out" : `ML service unavailable: ${e.message}`);
    }
  }
}

export class MockMLService {
  name = "mock";

  async health() {
    return { available: true, mock: true, modelVersion: "mock-heuristic", algorithm: "hand-written heuristic (NOT a trained model)" };
  }
  async sync() {}
  async reset() {}
  async ingest() {}
  async warm() {}
  async get() {
    return null;
  }

  /** `context` is { facts, graph } so the mock can be deterministic without a model. */
  async score(_tx, { context } = {}) {
    const f = context.facts;
    const g = context.graph;
    let z = -4;
    z += Math.min(3, f.payments5m / 10);
    z += f.recipientAgeDays < 7 ? 1 : 0;
    z += Math.min(2, f.complaintRate * 6);
    z += g.score / 40;
    z += Math.min(1, f.fundTransferVelocity);
    const probability = 1 / (1 + Math.exp(-z));
    return {
      available: true,
      mock: true,
      score: Math.round(probability * 100),
      probability: Number(probability.toFixed(4)),
      isFraudPrediction: probability >= 0.5,
      modelVersion: "mock-heuristic",
      algorithm: "hand-written heuristic (NOT a trained model)",
      topFactors: [],
      protectiveFactors: [],
      scamDna: null,
      features: {},
      latencyMs: 0,
    };
  }
}

export function createMLService(config) {
  if (!config.enabled) return new DisabledMLService();
  if (config.mode === "mock") return new MockMLService();
  return new PythonMLService({ url: config.url, timeoutMs: config.timeoutMs });
}
