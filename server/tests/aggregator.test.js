import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRisk, normalizeWeights } from "../fraud/riskAggregator.js";
import { loadFraudConfig } from "../fraud/config.js";

const config = loadFraudConfig({});
const quietFacts = { recipientBlocked: false, payments5m: 0 };
const noGraph = { connectedBlocked: 0 };
const run = (ml, graph, rules, facts = quietFacts, graphDetail = noGraph, cfg = config) =>
  aggregateRisk({ ml: { available: true, score: ml }, graph: { score: graph }, rules: { score: rules }, facts, graphDetail }, cfg);

test("all engines high => CRITICAL and BLOCK", () => {
  const r = run(95, 95, 95);
  assert.equal(r.riskLevel, "CRITICAL");
  assert.equal(r.decision, "BLOCK");
  assert.ok(r.riskScore >= 85);
});

test("all engines low => SAFE and LOW", () => {
  const r = run(2, 0, 0);
  assert.equal(r.decision, "SAFE");
  assert.equal(r.riskLevel, "LOW");
  assert.ok(r.riskScore < 10);
});

test("mixed moderate signals land in WARNING", () => {
  const r = run(70, 10, 30);
  assert.equal(r.decision, "WARNING");
});

test("default weights are 0.40 / 0.35 / 0.25 and the score is their weighted mean", () => {
  assert.deepEqual(config.weights, { mlWeight: 0.4, graphWeight: 0.35, ruleWeight: 0.25 });
  const r = run(50, 40, 20);
  assert.equal(r.riskScore, Math.round(50 * 0.4 + 40 * 0.35 + 20 * 0.25));
});

test("weights are configurable through the environment", () => {
  const cfg = loadFraudConfig({ RISK_ML_WEIGHT: "1", RISK_GRAPH_WEIGHT: "0", RISK_RULE_WEIGHT: "0" });
  const r = run(42, 60, 60, quietFacts, noGraph, cfg);
  assert.equal(r.riskScore, 42);
});

test("weights are re-normalised and ML weight is dropped when ML is unavailable", () => {
  const w = normalizeWeights({ mlWeight: 0.4, graphWeight: 0.35, ruleWeight: 0.25 }, false);
  assert.equal(w.ml, 0);
  assert.ok(Math.abs(w.graph + w.rules - 1) < 1e-9);
});

test("ML unavailable but graph risk is high => still HIGH/CRITICAL and blocked", () => {
  const r = aggregateRisk({ ml: { available: false }, graph: { score: 92 }, rules: { score: 20 }, facts: quietFacts, graphDetail: noGraph }, config);
  assert.ok(["HIGH", "CRITICAL"].includes(r.riskLevel), r.riskLevel);
  assert.equal(r.decision, "BLOCK");
  assert.ok(r.overridesApplied.some((o) => o.id === "ML_UNAVAILABLE_EVIDENCE_FLOOR"));
});

test("a confirmed blocked recipient is CRITICAL even when ML says it is safe", () => {
  const r = run(0, 0, 0, { recipientBlocked: true, payments5m: 0 });
  assert.equal(r.riskLevel, "CRITICAL");
  assert.equal(r.decision, "BLOCK");
  assert.equal(r.riskScore, 100);
});

test("multiple confirmed scam connections + extreme velocity => CRITICAL regardless of ML", () => {
  const r = run(5, 30, 30, { recipientBlocked: false, payments5m: 25 }, { connectedBlocked: 3 });
  assert.equal(r.riskLevel, "CRITICAL");
  assert.equal(r.decision, "BLOCK");
  assert.ok(r.overridesApplied.some((o) => o.id === "CONFIRMED_NETWORK_EXTREME_VELOCITY"));
});

test("confirmed connections alone (no velocity) do not trigger the override", () => {
  const r = run(5, 30, 30, { recipientBlocked: false, payments5m: 2 }, { connectedBlocked: 3 });
  assert.notEqual(r.riskLevel, "CRITICAL");
});

test("a strong rule or graph signal is not averaged away by a calm model, but it only reaches WARNING", () => {
  const r = run(2, 0, 65);
  assert.equal(r.decision, "WARNING");
  assert.ok(r.overridesApplied.some((o) => o.id === "STRONG_SIGNAL_FLOOR"));
  const g = run(2, 70, 0);
  assert.equal(g.decision, "WARNING");
  assert.notEqual(run(2, 0, 100).riskLevel, "CRITICAL", "floor alone never blocks");
});

test("a confident ML score alone is not amplified by the floor", () => {
  const r = run(99, 1, 36);
  assert.equal(r.riskScore, Math.round(99 * 0.4 + 1 * 0.35 + 36 * 0.25));
  assert.equal(r.overridesApplied.length, 0);
});

test("score is always clamped to 0-100", () => {
  const hi = run(500, 500, 500);
  const lo = run(-50, -50, -50);
  assert.ok(hi.riskScore <= 100 && lo.riskScore >= 0);
});
