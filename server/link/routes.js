import { Router } from "express";
import { analyzeLinkRequest } from "../../shared/linkEngine.js";

export function createLinkRouter() {
  const router = Router();

  router.post("/check", (req, res) => {
    const out = analyzeLinkRequest(req.body);
    if (out.error) {
      return res.status(out.status || 400).json({ error: out.error });
    }
    return res.json({ results: out.results });
  });

  return router;
}
