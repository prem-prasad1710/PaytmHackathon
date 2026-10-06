import express from "express";
import { ValidationError } from "./engine.js";

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof ValidationError) return res.status(err.status).json({ error: err.message });
    console.error("fraud route error:", err);
    res.status(500).json({ error: "internal error" });
  }
};

export function createFraudRouter(engine) {
  const router = express.Router();

  router.get("/health", wrap(async (_req, res) => {
    const health = await engine.ml.health();
    res.json({ ok: true, mlAvailable: Boolean(health.available), mlMode: engine.ml.name, ml: health, ledger: engine.ledger.stats() });
  }));

  router.get("/overview", wrap(async (_req, res) => res.json(await engine.overview())));

  router.post("/evaluate", wrap(async (req, res) => {
    const body = req.body || {};
    const tx = body.transaction ?? body;
    const decision = await engine.evaluate(tx);
    if (body.settle === true && decision.decision !== "BLOCK") await engine.settle(tx);
    res.json(decision);
  }));

  router.post("/scenario/:name", wrap(async (req, res) => res.json(await engine.scenario(req.params.name))));

  router.post("/stream/next", wrap(async (req, res) => {
    const count = Math.min(10, Math.max(1, Number(req.body?.count) || 1));
    const decisions = [];
    for (let i = 0; i < count; i += 1) decisions.push(await engine.streamNext());
    res.json({ decisions });
  }));

  router.get("/recent", (req, res) => res.json({ decisions: engine.recent(Math.min(60, Number(req.query.limit) || 20)) }));

  router.get("/network/:accountId", wrap(async (req, res) => {
    const net = engine.network(req.params.accountId);
    if (!net) return res.status(404).json({ error: "unknown account" });
    res.json(net);
  }));

  router.post("/reset", wrap(async (_req, res) => res.json({ ok: true, ledger: await engine.reset() })));

  return router;
}
