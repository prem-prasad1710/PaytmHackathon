import { Router } from "express";

export function createConsoleRouter(_engine) {
  const router = Router();
  router.get("/cases", (_req, res) => res.status(501).json({ error: "not implemented" }));
  return router;
}
