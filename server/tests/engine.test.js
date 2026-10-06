import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { FraudEngine, ValidationError } from "../fraud/engine.js";
import { loadFraudConfig } from "../fraud/config.js";
import { loadWorld } from "../fraud/world.js";
import { MockMLService, DisabledMLService, PythonMLService } from "../fraud/mlService.js";
import { TransactionSimulator } from "../fraud/simulator.js";
import { analyzeGraph } from "../fraud/graphEngine.js";
import { evaluateRules } from "../fraud/ruleEngine.js";
import { createFraudRouter } from "../fraud/routes.js";

const config = loadFraudConfig({});
const world = loadWorld();
const mockEngine = (ml = new MockMLService(), w = world) => new FraudEngine({ config, mlService: ml, world: w });

test("demo world: ledger reproduces the scam recipient's profile from raw events", () => {
  const e = mockEngine();
  const f = e.ledger.facts({ ...world.scenarios.scam.transaction, ts: e.clock });
  assert.equal(f.payments5m, 43);
  assert.equal(f.complaints, 17);
  assert.equal(f.deviceUsers, 8);
  assert.ok(Math.abs(f.recipientAgeDays - 3) < 0.01);
  assert.ok(Math.abs(f.complaintRate - 0.31) < 0.01);
  const g = analyzeGraph(e.ledger, "scammer_demo@upi");
  assert.equal(g.connectedBlocked, 3);
  assert.ok(g.score >= 90);
});

test("rule engine: legitimate merchant triggers nothing, scam recipient triggers many rules", () => {
  const e = mockEngine();
  const ok = evaluateRules(e.ledger.facts({ ...world.scenarios.normal.transaction, ts: e.clock }));
  assert.equal(ok.score, 0);
  assert.deepEqual(ok.triggeredRules, []);
  const bad = evaluateRules(e.ledger.facts({ ...world.scenarios.scam.transaction, ts: e.clock }));
  for (const id of ["HIGH_VELOCITY", "HIGH_COMPLAINT_RATE", "DEVICE_SHARING", "NEW_ACCOUNT_RECIPIENT"]) assert.ok(bad.triggeredRules.includes(id), id);
  assert.ok(bad.score > 90);
});

test("three demo scenarios end up SAFE / not-BLOCK / BLOCK", async () => {
  const e = mockEngine();
  const normal = (await e.scenario("normal")).decision;
  const scam = (await e.scenario("scam")).decision;
  assert.equal(normal.decision, "SAFE");
  assert.equal(scam.decision, "BLOCK");
  assert.equal(scam.riskLevel, "CRITICAL");
  assert.ok(scam.riskScore > normal.riskScore);
  assert.ok(scam.explanation.length >= 3);
});

test("decision object has the documented shape", async () => {
  const d = (await mockEngine().scenario("scam")).decision;
  for (const k of ["riskScore", "riskLevel", "decision", "ml", "graph", "rules", "explanation"]) assert.ok(k in d, k);
  for (const k of ["score", "probability", "modelVersion"]) assert.ok(k in d.ml, k);
  for (const k of ["score", "connectedEntities", "connectedVictims"]) assert.ok(k in d.graph, k);
  for (const k of ["score", "triggeredRules"]) assert.ok(k in d.rules, k);
});

test("decisions come from evidence, not from the recipient's name", async () => {
  const renamed = JSON.parse(JSON.stringify(world).replaceAll("scammer_demo@upi", "totally_unrelated@upi"));
  const a = (await mockEngine().scenario("scam")).decision;
  const b = (await mockEngine(new MockMLService(), renamed).scenario("scam")).decision;
  assert.equal(b.decision, "BLOCK");
  assert.equal(a.riskScore, b.riskScore);
  assert.equal(a.graph.score, b.graph.score);
});

test("ML service disabled: mlAvailable=false, rules + graph still block the scam", async () => {
  const e = mockEngine(new DisabledMLService());
  const scam = (await e.scenario("scam")).decision;
  assert.equal(scam.mlAvailable, false);
  assert.equal(scam.ml.score, null);
  assert.equal(scam.decision, "BLOCK");
  assert.ok(scam.explanation.some((l) => /ML model unavailable/.test(l)));
  const normal = (await e.scenario("normal")).decision;
  assert.equal(normal.decision, "SAFE");
});

test("ML service unreachable: PythonMLService reports unavailable instead of throwing", async () => {
  const ml = new PythonMLService({ url: "http://127.0.0.1:9", timeoutMs: 300 });
  const e = new FraudEngine({ config, mlService: ml, world });
  const t0 = Date.now();
  const scam = (await e.scenario("scam")).decision;
  assert.equal(scam.mlAvailable, false);
  assert.equal(scam.decision, "BLOCK");
  const second = await e.evaluate(world.scenarios.scam.transaction);
  assert.equal(second.mlAvailable, false);
  assert.ok(Date.now() - t0 < 2000, "outage must not slow every payment");
  assert.equal(e.monitoring.snapshot().ml_unavailable_count, 2);
});

test("invalid transactions are rejected with a ValidationError", async () => {
  const e = mockEngine();
  const base = { senderId: "user_001", recipientId: "bigbasket@upi", amount: 100 };
  for (const bad of [{ ...base, amount: -5 }, { ...base, amount: "abc" }, { ...base, amount: 0 }, { ...base, recipientId: "" }, { ...base, recipientId: "user_001" }, null]) {
    await assert.rejects(() => e.evaluate(bad), ValidationError);
  }
});

test("a large first payment to an unseen account is flagged for review", async () => {
  const e = mockEngine();
  const d = await e.evaluate({ senderId: "user_001", recipientId: "never_seen@upi", amount: 200000, deviceId: "D_user_001", ipAddress: "IP_user_001" });
  assert.ok(d.rules.triggeredRules.includes("LARGE_FIRST_PAYMENT"));
  assert.equal(d.decision, "WARNING");
  const small = await e.evaluate({ senderId: "user_001", recipientId: "never_seen@upi", amount: 400, deviceId: "D_user_001", ipAddress: "IP_user_001" });
  assert.equal(small.decision, "SAFE");
});

test("client timestamps cannot move the demo clock into the future", async () => {
  const e = mockEngine();
  const base = { senderId: "user_001", recipientId: "bigbasket@upi", amount: 100 };
  await assert.rejects(() => e.evaluate({ ...base, timestamp: e.clock + 10 * 86400 }), ValidationError);
  await assert.rejects(() => e.evaluate({ ...base, recipientId: "x".repeat(200) }), /at most 128/);
  await assert.rejects(() => e.scenario("__proto__"), ValidationError);
});

test("unknown accounts are scored without crashing", async () => {
  const d = await mockEngine().evaluate({ senderId: "brand_new_a", recipientId: "brand_new_b", amount: 250 });
  assert.ok(d.riskScore >= 0 && d.riskScore <= 100);
  assert.equal(d.graph.score, 0);
});

test("simulator is deterministic for a seed and differs across seeds", () => {
  const take = (seed) => {
    const s = new TransactionSimulator(world, { seed });
    return Array.from({ length: 60 }, () => JSON.stringify(s.next()));
  };
  assert.deepEqual(take(7), take(7));
  assert.notDeepEqual(take(7), take(8));
});

test("live stream is reproducible and monitoring only counts real evaluations", async () => {
  const run = async () => {
    const e = mockEngine();
    const out = [];
    for (let i = 0; i < 25; i += 1) out.push((await e.streamNext()).riskScore);
    return { out, snap: e.monitoring.snapshot() };
  };
  const a = await run();
  const b = await run();
  assert.deepEqual(a.out, b.out);
  assert.equal(a.snap.prediction_count, 25);
  assert.equal(a.snap.decisions.SAFE + a.snap.decisions.WARNING + a.snap.decisions.BLOCK, 25);
});

test("blocked payments are not settled; allowed ones are", async () => {
  const e = mockEngine();
  const before = e.ledger.eventCount;
  const blocked = await e.evaluate(world.scenarios.scam.transaction);
  assert.equal(blocked.decision, "BLOCK");
  assert.equal(e.ledger.eventCount, before, "evaluate alone never mutates the ledger");
  await e.settle(world.scenarios.normal.transaction);
  assert.equal(e.ledger.eventCount, before + 1);
});

test("reset restores the demo world", async () => {
  const e = mockEngine();
  const base = e.ledger.eventCount;
  for (let i = 0; i < 10; i += 1) await e.streamNext();
  await e.reset();
  assert.equal(e.ledger.eventCount, base);
  assert.equal(e.monitoring.snapshot().prediction_count, 0);
});

test("scenarios are reproducible even after the live stream has advanced the clock", async () => {
  const e = mockEngine();
  const first = (await e.scenario("scam")).decision;
  for (let i = 0; i < 40; i += 1) await e.streamNext();
  const counted = e.monitoring.snapshot().prediction_count;
  const again = (await e.scenario("scam")).decision;
  assert.equal(again.riskScore, first.riskScore);
  assert.equal(again.facts.payments5m, 43);
  assert.equal(e.monitoring.snapshot().prediction_count, counted + 1, "counters survive a scenario run");
});

test("network view exposes the ring around the scam account", () => {
  const net = mockEngine().network("scammer_demo@upi");
  assert.ok(net.nodes.length > 5);
  assert.ok(net.nodes.some((n) => n.blocked));
  assert.ok(net.edges.some((e) => e.type === "device"));
  assert.equal(mockEngine().network("nobody@upi"), null);
});

// ---------------------------------------------------------------- PythonMLService contract
function fakeMlServer({ failPredict = false } = {}) {
  const calls = [];
  let events = 0;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = body ? JSON.parse(body) : null;
      calls.push({ method: req.method, url: req.url, body: json });
      const send = (code, obj) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (req.url === "/health") return send(200, { ok: true, modelVersion: "vTest" });
      if (req.url === "/state") return send(200, { events });
      if (req.url === "/state/reset") {
        events = 0;
        return send(200, { ok: true });
      }
      if (req.url === "/ingest") {
        events += json.events.length;
        return send(200, { applied: json.events.length });
      }
      if (req.url === "/predict") {
        if (failPredict) return send(500, { detail: "boom" });
        return send(200, {
          fraudProbability: 0.8, riskScore: 80, isFraudPrediction: true, threshold: 0.5, modelVersion: "vTest", algorithm: "xgboost",
          topFactors: [{ feature: "x", text: "because", impact: "high" }], latencyMs: 1.2, ledgerEvents: events,
        });
      }
      send(404, {});
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}` })));
}

test("PythonMLService: syncs the ledger, sends the documented payload, maps the response", async () => {
  const fake = await fakeMlServer();
  try {
    const ml = new PythonMLService({ url: fake.url });
    const e = new FraudEngine({ config, mlService: ml, world });
    const d = await e.evaluate(world.scenarios.normal.transaction);
    const ingested = fake.calls.filter((c) => c.url === "/ingest").reduce((n, c) => n + c.body.events.length, 0);
    assert.equal(ingested, e.ledger.eventCount);
    const predict = fake.calls.find((c) => c.url === "/predict");
    assert.deepEqual(Object.keys(predict.body.transaction).sort(), ["amount", "deviceId", "ipAddress", "recipientId", "senderId", "timestamp", "transactionId"]);
    assert.equal(d.ml.modelVersion, "vTest");
    assert.equal(d.ml.probability, 0.8);
    assert.equal(d.mlAvailable, true);
  } finally {
    fake.server.close();
  }
});

test("PythonMLService: server error degrades to mlAvailable=false", async () => {
  const fake = await fakeMlServer({ failPredict: true });
  try {
    const e = new FraudEngine({ config, mlService: new PythonMLService({ url: fake.url }), world });
    const d = await e.evaluate(world.scenarios.scam.transaction);
    assert.equal(d.mlAvailable, false);
    assert.equal(d.decision, "BLOCK");
  } finally {
    fake.server.close();
  }
});

// ---------------------------------------------------------------- HTTP routes
async function withApi(fn) {
  const app = express();
  app.use(express.json());
  app.use("/api/fraud", createFraudRouter(mockEngine()));
  const server = await new Promise((r) => {
    const s = app.listen(0, "127.0.0.1", () => r(s));
  });
  try {
    await fn(`http://127.0.0.1:${server.address().port}/api/fraud`);
  } finally {
    server.close();
  }
}
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("API: valid evaluate, invalid evaluate, scenario, stream, network, overview", async () => {
  await withApi(async (base) => {
    const ok = await post(`${base}/evaluate`, { transaction: world.scenarios.scam.transaction });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).decision, "BLOCK");

    const bad = await post(`${base}/evaluate`, { transaction: { senderId: "a", recipientId: "b", amount: -1 } });
    assert.equal(bad.status, 422);
    assert.ok((await bad.json()).error);

    const sc = await post(`${base}/scenario/normal`, {});
    assert.equal((await sc.json()).decision.decision, "SAFE");
    assert.equal((await post(`${base}/scenario/nope`, {})).status, 422);

    const stream = await (await post(`${base}/stream/next`, { count: 3 })).json();
    assert.equal(stream.decisions.length, 3);

    assert.equal((await fetch(`${base}/network/scammer_demo@upi`)).status, 200);
    assert.equal((await fetch(`${base}/network/ghost`)).status, 404);

    const overview = await (await fetch(`${base}/overview`)).json();
    assert.equal(overview.monitoring.prediction_count >= 5, true);
    assert.equal(overview.metrics, null, "mock ML exposes no model metrics");
  });
});
