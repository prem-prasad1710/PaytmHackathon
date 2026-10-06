import { Ledger } from "./ledger.js";
import { analyzeGraph, buildNetwork } from "./graphEngine.js";
import { evaluateRules } from "./ruleEngine.js";
import { aggregateRisk } from "./riskAggregator.js";
import { buildExplanation } from "./explainer.js";
import { FraudMonitoring } from "./monitoring.js";
import { TransactionSimulator } from "./simulator.js";
import { loadWorld, WORLD_NOW } from "./world.js";
import { createMLService } from "./mlService.js";
import { loadFraudConfig } from "./config.js";

export class ValidationError extends Error {
  status = 422;
}

const STREAM_STEP_S = 2;
const HISTORY = 60;

const MAX_FUTURE_S = 86400;

function normalize(input, fallbackTs) {
  if (!input || typeof input !== "object") throw new ValidationError("transaction must be an object");
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw new ValidationError("amount must be a positive number");
  for (const key of ["senderId", "recipientId"]) {
    if (typeof input[key] !== "string" || !input[key].trim()) throw new ValidationError(`${key} is required`);
    if (input[key].length > 128) throw new ValidationError(`${key} must be at most 128 characters`);
  }
  if (input.senderId === input.recipientId) throw new ValidationError("senderId and recipientId must differ");
  const optional = (v) => (typeof v === "string" && v.trim() ? v.slice(0, 128) : null);
  const ts = input.timestamp === undefined || input.timestamp === null ? fallbackTs : Number(input.timestamp);
  if (!Number.isFinite(ts) || ts < 0) throw new ValidationError("timestamp must be a non-negative number");
  if (ts > fallbackTs + MAX_FUTURE_S) throw new ValidationError("timestamp is too far in the future");
  return {
    transactionId: optional(input.transactionId),
    senderId: input.senderId.trim(),
    recipientId: input.recipientId.trim(),
    amount,
    deviceId: optional(input.deviceId),
    ipAddress: optional(input.ipAddress),
    ts,
  };
}

export class FraudEngine {
  constructor({ config = loadFraudConfig(), mlService, world = loadWorld() } = {}) {
    this.config = config;
    this.world = world;
    this.ml = mlService || createMLService(config.ml);
    this.ledger = new Ledger();
    this.monitoring = new FraudMonitoring();
    this.simulator = new TransactionSimulator(world, { seed: config.simulator.seed });
    this.history = [];
    this.sequence = 0;
    this.clock = WORLD_NOW;
    this.ml.attachLedger?.(this.ledger);
    this.#loadWorld();
  }

  /** Pre-load the ML feature store so the first payment does not pay for the sync. */
  async warmUp() {
    await this.ml.warm();
  }

  #loadWorld() {
    this.ledger.load(this.world.events);
    this.clock = WORLD_NOW;
    this.baseEvents = this.ledger.eventCount;
  }

  /** Put the ledger (and the ML feature store) back at the demo world's "now", keeping counters and history. */
  async #rewind() {
    this.#loadWorld();
    await this.ml.reset();
    await this.warmUp();
  }

  async reset() {
    this.#loadWorld();
    this.simulator.reset();
    this.monitoring.reset();
    this.history = [];
    this.sequence = 0;
    await this.ml.reset();
    await this.warmUp();
    return this.ledger.stats();
  }

  /** Score one payment with ML + graph + rules. Does not change the ledger. */
  async evaluate(input) {
    const t0 = performance.now();
    const tx = normalize(input, this.clock);
    const facts = this.ledger.facts(tx);
    const graphDetail = analyzeGraph(this.ledger, tx.recipientId);
    const rules = evaluateRules(facts);
    const ml = await this.ml.score(tx, { context: { facts, graph: graphDetail } });
    const aggregation = aggregateRisk({ ml, graph: { score: graphDetail.score }, rules, facts, graphDetail }, this.config);

    const result = {
      id: tx.transactionId || `tx_${String(++this.sequence).padStart(5, "0")}`,
      timestamp: tx.ts,
      transaction: { senderId: tx.senderId, recipientId: tx.recipientId, amount: tx.amount, deviceId: tx.deviceId, ipAddress: tx.ipAddress },
      riskScore: aggregation.riskScore,
      riskLevel: aggregation.riskLevel,
      decision: aggregation.decision,
      mlAvailable: ml.available,
      ml: {
        available: ml.available,
        mock: ml.mock,
        score: ml.score,
        probability: ml.probability,
        modelVersion: ml.modelVersion,
        algorithm: ml.algorithm || null,
        threshold: ml.threshold ?? null,
        topFactors: ml.topFactors || [],
        protectiveFactors: ml.protectiveFactors || [],
        scamDna: ml.scamDna || null,
        latencyMs: ml.latencyMs ?? null,
        error: ml.error || null,
      },
      graph: {
        score: graphDetail.score,
        connectedEntities: graphDetail.connectedFlagged,
        connectedBlocked: graphDetail.connectedBlocked,
        connectedVictims: graphDetail.connectedVictims,
        distanceToBlocked: graphDetail.distanceToBlocked,
        ringSize: graphDetail.ringSize,
        reasons: graphDetail.reasons,
      },
      rules: { score: rules.score, triggeredRules: rules.triggeredRules, details: rules.ruleDetails },
      aggregation: {
        weights: aggregation.weights,
        weightedScore: aggregation.weightedScore,
        overridesApplied: aggregation.overridesApplied,
        thresholds: this.config.thresholds,
      },
      facts: {
        recipientAgeDays: Number(facts.recipientAgeDays.toFixed(2)),
        payments5m: facts.payments5m,
        payments1h: facts.payments1h,
        complaints: facts.complaints,
        complaintRate: Number(facts.complaintRate.toFixed(3)),
        deviceUsers: facts.deviceUsers,
        fundTransferVelocity: Number(facts.fundTransferVelocity.toFixed(2)),
      },
    };
    const text = buildExplanation({
      ...result,
      ml: result.ml,
      graph: result.graph,
      rules: { ...result.rules, ruleDetails: rules.ruleDetails, triggeredRules: rules.triggeredRules },
      aggregation,
      transaction: result.transaction,
      facts: result.facts,
    });
    result.summary = text.summary;
    result.explanation = text.explanation;
    result.explanationSource = text.generatedBy;
    if (text.playbook) result.playbook = text.playbook;
    if (text.dual) result.dual = text.dual;
    result.latencyMs = Number((performance.now() - t0).toFixed(2));
    this.monitoring.record(result);
    return result;
  }

  /** Record a completed payment in the ledger (and the ML feature store). */
  async settle(input) {
    const tx = normalize(input, this.clock);
    const event = {
      type: "transaction",
      ts: Math.max(tx.ts, this.ledger.lastTs),
      sender_id: tx.senderId,
      recipient_id: tx.recipientId,
      amount: tx.amount,
      device_id: tx.deviceId,
      ip_id: tx.ipAddress,
    };
    this.ledger.apply(event);
    await this.ml.ingest([event]);
    this.clock = Math.max(this.clock, event.ts);
  }

  async scenario(name) {
    const sc = Object.hasOwn(this.world.scenarios, name) ? this.world.scenarios[name] : null;
    if (!sc) throw new ValidationError(`unknown scenario: ${name}`);
    if (this.clock !== WORLD_NOW) await this.#rewind();
    const decision = await this.evaluate(sc.transaction);
    this.#remember(decision, { scenario: name });
    return { scenario: name, label: sc.label, story: sc.story, decision };
  }

  /** One step of the live stream: generate a payment, score it, settle it unless blocked. */
  async streamNext() {
    const { transaction } = this.simulator.next();
    const decision = await this.evaluate({ ...transaction, timestamp: this.clock });
    if (decision.decision !== "BLOCK") await this.settle({ ...transaction, timestamp: this.clock });
    this.clock += STREAM_STEP_S;
    this.#remember(decision, { live: true });
    return decision;
  }

  #remember(decision, meta = {}) {
    this.history.unshift({ ...decision, ...meta });
    if (this.history.length > HISTORY) this.history.pop();
  }

  recent(limit = 20) {
    return this.history.slice(0, limit);
  }

  network(accountId) {
    if (!this.ledger.has(accountId)) return null;
    const graph = analyzeGraph(this.ledger, accountId);
    return { accountId, graph, ...buildNetwork(this.ledger, accountId) };
  }

  async overview() {
    const health = await this.ml.health();
    const [metrics, importance, model, scamDna, mlMonitoring] = health.available && !health.mock
      ? await Promise.all([
          this.ml.get("/metrics"),
          this.ml.get("/importance"),
          this.ml.get("/model"),
          this.ml.get("/scam-dna"),
          this.ml.get("/monitoring"),
        ])
      : [null, null, null, null, null];
    return {
      mlAvailable: Boolean(health.available),
      mlMode: this.ml.name,
      health,
      model,
      metrics,
      importance,
      scamDna,
      mlMonitoring,
      monitoring: this.monitoring.snapshot(),
      ledger: this.ledger.stats(),
      config: { weights: this.config.weights, thresholds: this.config.thresholds, overrides: this.config.overrides },
      scenarios: Object.fromEntries(Object.entries(this.world.scenarios).map(([k, v]) => [k, { label: v.label, story: v.story, transaction: v.transaction }])),
    };
  }
}
