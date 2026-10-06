import { Router } from "express";

export function createLinkRouter() {
  const router = Router();
  router.post("/check", (_req, res) => res.status(501).json({ error: "not implemented" }));
  return router;
}
