import { Router } from "express";
import { CaseStore } from "./cases.js";

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("console route error:", err);
    res.status(500).json({ error: "internal error" });
  }
};

export function createConsoleRouter(engine, { store = new CaseStore() } = {}) {
  store.attach(engine);
  const router = Router();

  router.get("/cases", (req, res) => {
    const cases = store.list({
      status: req.query.status || undefined,
      decision: req.query.decision || undefined,
      limit: req.query.limit,
      sort: req.query.sort === "score" ? "score" : "age",
    });
    res.json({ cases, total: cases.length });
  });

  router.get("/cases/:id", (req, res) => {
    const caseRecord = store.get(req.params.id);
    if (!caseRecord) return res.status(404).json({ error: "case not found" });
    res.json({ case: caseRecord });
  });

  router.post("/cases/:id/review", wrap(async (req, res) => {
    const body = req.body || {};
    if (!body.verdict) {
      return res.status(400).json({ error: "verdict is required" });
    }
    const caseRecord = store.review(req.params.id, { verdict: body.verdict, note: body.note });
    res.json({ case: caseRecord });
  }));

  router.get("/stats", (_req, res) => {
    res.json(store.stats());
  });

  router.get("/export.jsonl", (_req, res) => {
    const body = store.exportJsonl();
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Content-Disposition", 'attachment; filename="fraud-feedback.jsonl"');
    res.send(body);
  });

  router.post("/seed", wrap(async (req, res) => {
    const count = Math.min(200, Math.max(1, Number(req.body?.count) || 25));
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const decision = await engine.streamNext();
      const caseRecord = store.ingest(decision, { seeded: true, live: true });
      if (caseRecord) created.push(caseRecord.id);
    }
    res.json({
      ok: true,
      simulated: true,
      message: "Simulated live-stream payments — not real customer data.",
      streamed: count,
      casesOpened: created.length,
      caseIds: created,
    });
  }));

  return router;
}
