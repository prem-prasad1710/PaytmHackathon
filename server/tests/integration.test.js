import test from "node:test";
import assert from "node:assert/strict";
import { FraudEngine } from "../fraud/engine.js";
import { loadFraudConfig } from "../fraud/config.js";
import { PythonMLService } from "../fraud/mlService.js";

// Runs only when the real Python model service is up (npm run dev:ml). Skipped otherwise.
const config = loadFraudConfig();
const ml = new PythonMLService({ url: config.ml.url, timeoutMs: config.ml.timeoutMs });
const health = await ml.health();

test("real XGBoost service: normal=SAFE, suspicious=WARNING, scam=BLOCK", { skip: !health.available && "ML service not running" }, async () => {
  const e = new FraudEngine({ config, mlService: ml });
  const normal = (await e.scenario("normal")).decision;
  const suspicious = (await e.scenario("suspicious")).decision;
  const scam = (await e.scenario("scam")).decision;

  for (const d of [normal, suspicious, scam]) {
    assert.equal(d.mlAvailable, true);
    assert.equal(d.ml.mock, false);
    assert.match(d.ml.algorithm, /xgboost|boost/i);
    assert.ok(d.ml.probability >= 0 && d.ml.probability <= 1);
    assert.ok(d.ml.latencyMs < 100, `inference ${d.ml.latencyMs}ms`);
  }
  assert.equal(normal.decision, "SAFE");
  assert.equal(suspicious.decision, "WARNING");
  assert.equal(scam.decision, "BLOCK");
  assert.ok(scam.ml.topFactors.length > 0);
  assert.ok(scam.ml.probability > suspicious.ml.probability || scam.ml.probability > 0.9);
});

test("real service stays in sync with the Node ledger after streaming payments", { skip: !health.available && "ML service not running" }, async () => {
  const e = new FraudEngine({ config, mlService: ml });
  await e.reset();
  for (let i = 0; i < 15; i += 1) await e.streamNext();
  const state = await ml.get("/state");
  assert.equal(state.events, e.ledger.eventCount);
});
