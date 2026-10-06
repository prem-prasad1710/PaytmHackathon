import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { FraudEngine } from "../fraud/engine.js";
import { loadFraudConfig } from "../fraud/config.js";
import { loadWorld } from "../fraud/world.js";
import { MockMLService, DisabledMLService } from "../fraud/mlService.js";
import { CaseStore } from "../fraud/cases.js";
import { createConsoleRouter } from "../fraud/consoleRoutes.js";

const config = loadFraudConfig({});
const world = loadWorld();
const mockEngine = (ml = new MockMLService()) => new FraudEngine({ config, mlService: ml, world });

async function withConsole(fn, { ml = new MockMLService(), store } = {}) {
  const engine = mockEngine(ml);
  const caseStore = store || new CaseStore({ maxSize: 500 });
  const app = express();
  app.use(express.json());
  app.use("/api/console", createConsoleRouter(engine, { store: caseStore }));
  const server = await new Promise((r) => app.listen(0, "127.0.0.1", () => r(app)));
  const base = `http://127.0.0.1:${server.address().port}/api/console`;
  try {
    await fn({ engine, store: caseStore, base });
  } finally {
    server.close();
  }
}

const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
const get = (url) => fetch(url);

test("CaseStore: opens cases for WARNING and BLOCK, not SAFE", async () => {
  const engine = mockEngine();
  const store = new CaseStore();
  store.attach(engine);
  await engine.scenario("normal");
  await engine.scenario("scam");
  const d = await engine.evaluate({
    senderId: "user_001",
    recipientId: "never_seen@upi",
    amount: 200000,
    deviceId: "D_user_001",
    ipAddress: "IP_user_001",
  });
  assert.equal(d.decision, "WARNING");
  const cases = store.list();
  assert.equal(cases.some((c) => c.decisionSnapshot.decision === "BLOCK"), true);
  assert.equal(cases.some((c) => c.decisionSnapshot.decision === "WARNING"), true);
  assert.equal(cases.some((c) => c.decisionSnapshot.decision === "SAFE"), false);
});

test("CaseStore: no duplicate cases for the same decision id", async () => {
  const engine = mockEngine();
  const store = new CaseStore();
  store.attach(engine);
  await engine.scenario("scam");
  const again = await engine.scenario("scam");
  store.ingest(again.decision, { scenario: "scam" });
  const scamCases = store.list({ decision: "BLOCK" });
  const ids = scamCases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("CaseStore: review confirmed_fraud sets status and reviewTimeMs", async () => {
  const store = new CaseStore();
  const engine = mockEngine();
  store.attach(engine);
  const { decision } = await engine.scenario("scam");
  const reviewed = store.review(decision.id, { verdict: "confirmed_fraud", note: "clear mule ring" });
  assert.equal(reviewed.status, "confirmed_fraud");
  assert.equal(reviewed.analystNote, "clear mule ring");
  assert.ok(reviewed.reviewedAt);
  assert.ok(reviewed.reviewTimeMs >= 0);
});

test("CaseStore: re-review overwrites and keeps history", async () => {
  const store = new CaseStore();
  const engine = mockEngine();
  store.attach(engine);
  const { decision } = await engine.scenario("scam");
  store.review(decision.id, { verdict: "confirmed_fraud", note: "first" });
  store.review(decision.id, { verdict: "false_positive", note: "second look" });
  const c = store.get(decision.id);
  assert.equal(c.status, "false_positive");
  assert.equal(c.analystNote, "second look");
  assert.equal(c.history.length, 1);
  assert.equal(c.history[0].status, "confirmed_fraud");
});

test("CaseStore: invalid verdict throws 400", () => {
  const store = new CaseStore();
  assert.throws(() => store.review("missing", { verdict: "maybe" }), (e) => e.status === 400);
});

test("CaseStore: unknown case review throws 404", () => {
  const store = new CaseStore();
  assert.throws(() => store.review("nope", { verdict: "confirmed_fraud" }), (e) => e.status === 404);
});

test("CaseStore: stats return null precision when no reviewed labels", async () => {
  const store = new CaseStore();
  const engine = mockEngine();
  store.attach(engine);
  await engine.scenario("scam");
  const s = store.stats();
  assert.equal(s.alertPrecision, null);
  assert.equal(s.alertPrecisionSampleSize, 0);
  assert.equal(s.falsePositiveRate, null);
});

test("CaseStore: stats compute precision, Wilson CI and engine agreement", async () => {
  const store = new CaseStore();
  const engine = mockEngine();
  store.attach(engine);
  for (let i = 0; i < 30; i += 1) await engine.streamNext();
  const cases = store.list({ limit: 200 });
  let i = 0;
  for (const c of cases) {
    if (c.status !== "open") continue;
    const verdict = i % 3 === 0 ? "false_positive" : "confirmed_fraud";
    store.review(c.id, { verdict, note: "batch" });
    i += 1;
    if (i >= 12) break;
  }
  const s = store.stats();
  assert.ok(s.alertPrecisionSampleSize >= 12);
  assert.ok(s.alertPrecision >= 0 && s.alertPrecision <= 1);
  assert.ok(s.alertPrecisionCi.low <= s.alertPrecision);
  assert.ok(s.alertPrecisionCi.high >= s.alertPrecision);
  assert.ok(s.meanReviewTimeMs !== null);
  assert.ok(s.medianReviewTimeMs !== null);
});

test("CaseStore: export JSONL only includes labelled non-escalated cases", async () => {
  const store = new CaseStore();
  const engine = mockEngine();
  store.attach(engine);
  const a = (await engine.scenario("scam")).decision;
  const b = (await engine.evaluate({
    senderId: "user_001",
    recipientId: "never_seen@upi",
    amount: 200000,
    deviceId: "D_user_001",
    ipAddress: "IP_user_001",
  })).id;
  store.review(a.id, { verdict: "confirmed_fraud", note: "fraud" });
  store.review(b, { verdict: "escalate", note: "unsure" });
  const lines = store.exportJsonl().trim().split("\n").filter(Boolean);
  assert.equal(lines.length, 1);
  const row = JSON.parse(lines[0]);
  assert.equal(row.label, "confirmed_fraud");
  assert.ok(row.scores.risk);
  assert.ok(row.transaction.recipientId);
});

test("CaseStore: eviction drops oldest reviewed cases first", async () => {
  const store = new CaseStore({ maxSize: 3 });
  const engine = mockEngine();
  store.attach(engine);
  for (let i = 0; i < 5; i += 1) {
    await engine.evaluate({
      senderId: "user_001",
      recipientId: `acct_${i}@upi`,
      amount: 200000 + i,
      deviceId: "D_user_001",
      ipAddress: "IP_user_001",
    });
  }
  const all = store.list({ limit: 10 });
  assert.ok(all.length <= 3);
});

test("API: GET /cases filters by status and decision", async () => {
  await withConsole(async ({ engine, base }) => {
    await engine.scenario("scam");
    await engine.evaluate({
      senderId: "user_001",
      recipientId: "never_seen@upi",
      amount: 200000,
      deviceId: "D_user_001",
      ipAddress: "IP_user_001",
    });
    const block = await (await get(`${base}/cases?decision=BLOCK`)).json();
    assert.ok(block.cases.every((c) => c.decisionSnapshot.decision === "BLOCK"));
    const warn = await (await get(`${base}/cases?decision=WARNING`)).json();
    assert.ok(warn.cases.length >= 1);
  });
});

test("API: GET /cases/:id returns 404 for unknown", async () => {
  await withConsole(async ({ base }) => {
    assert.equal((await get(`${base}/cases/unknown_id`)).status, 404);
  });
});

test("API: POST /cases/:id/review validates verdict and returns case", async () => {
  await withConsole(async ({ engine, base }) => {
    const { decision } = await engine.scenario("scam");
    const bad = await post(`${base}/cases/${decision.id}/review`, {});
    assert.equal(bad.status, 400);
    const ok = await post(`${base}/cases/${decision.id}/review`, { verdict: "confirmed_fraud", note: "obvious" });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.case.status, "confirmed_fraud");
  });
});

test("API: GET /stats reflects reviewed cases", async () => {
  await withConsole(async ({ engine, base }) => {
    const { decision } = await engine.scenario("scam");
    await post(`${base}/cases/${decision.id}/review`, { verdict: "confirmed_fraud", note: "y" });
    const stats = await (await get(`${base}/stats`)).json();
    assert.equal(stats.byStatus.confirmed_fraud, 1);
    assert.equal(stats.reviewed, 1);
    assert.equal(stats.alertPrecision, 1);
  });
});

test("API: GET /export.jsonl returns attachment", async () => {
  await withConsole(async ({ engine, base }) => {
    const { decision } = await engine.scenario("scam");
    await post(`${base}/cases/${decision.id}/review`, { verdict: "false_positive", note: "merchant ok" });
    const res = await get(`${base}/export.jsonl`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /json|ndjson/);
    assert.match(res.headers.get("content-disposition"), /fraud-feedback\.jsonl/);
    const text = await res.text();
    assert.ok(text.includes('"label":"false_positive"'));
  });
});

test("API: POST /seed advances stream and marks simulated", async () => {
  await withConsole(async ({ base }) => {
    const res = await post(`${base}/seed`, { count: 10 });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.simulated, true);
    assert.equal(body.streamed, 10);
    const stats = await (await get(`${base}/stats`)).json();
    assert.ok(stats.total >= 1);
  });
});

test("API: seed count is clamped between 1 and 200", async () => {
  await withConsole(async ({ base }) => {
    const res = await post(`${base}/seed`, { count: 999 });
    const body = await res.json();
    assert.equal(body.streamed, 200);
  });
});

test("live stream and scenarios both produce cases via engine hook", async () => {
  await withConsole(async ({ engine, store }) => {
    await engine.scenario("scam");
    await engine.streamNext();
    const cases = store.list({ limit: 50 });
    assert.ok(cases.length >= 2);
    assert.ok(cases.some((c) => c.source === "scenario"));
    assert.ok(cases.some((c) => c.source === "live" || c.simulated));
  });
});

test("ML disabled: cases still open with graph+rules scores", async () => {
  await withConsole(async ({ engine, store }) => {
    const { decision } = await engine.scenario("scam");
    const c = store.get(decision.id);
    assert.equal(c.decisionSnapshot.mlAvailable, false);
    assert.equal(c.decisionSnapshot.ml.score, null);
    assert.ok(c.decisionSnapshot.graph.score > 0);
    assert.ok(c.decisionSnapshot.rules.triggeredRules.length > 0);
  }, { ml: new DisabledMLService() });
});
