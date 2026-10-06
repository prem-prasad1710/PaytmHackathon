import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  pickMockByText,
  finalizeAnalysis,
  safeParseJson,
  extractEntities,
  COMPLAINT_REGISTRY,
} from "../shared/offlineEngine.js";
import {
  blendWithMl,
  heuristicTransactionRisk,
  mlHealth,
  mlMetrics,
  mlPredict,
  mlTransaction,
} from "./hybrid.js";
import { addReport, getStats } from "./reports.js";
import { FraudEngine } from "./fraud/engine.js";
import { createFraudRouter } from "./fraud/routes.js";
import { createConsoleRouter } from "./fraud/consoleRoutes.js";
import { createLinkRouter } from "./link/routes.js";
import { chatCompletion, llmStatus, resolveLlmConfig } from "./llmClient.js";
import {
  listTrustedContacts,
  createApprovalRequest,
  getApproval,
  decideApproval,
  listPending,
  listRecent,
} from "./familyApprovals.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);
if (String(process.env.ALLOW_INSECURE_TLS || "").toLowerCase() === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("ALLOW_INSECURE_TLS=true — TLS verification disabled");
}

const llmCfg = () => resolveLlmConfig();
const llmLive = () => llmCfg().provider !== "none";

const corsOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(cors({
  // Unset: reflect any origin (local Vite + LAN). In production set CORS_ORIGIN to the frontend URL(s).
  origin: corsOrigins.length ? corsOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
const fraudEngine = new FraudEngine();
fraudEngine.warmUp();
app.use("/api/fraud", createFraudRouter(fraudEngine));
app.use("/api/console", createConsoleRouter(fraudEngine));
app.use("/api/links", createLinkRouter());

app.get("/api/family/contacts", (_req, res) => {
  res.json({ contacts: listTrustedContacts() });
});

app.get("/api/family/pending", (_req, res) => {
  res.json({ pending: listPending(), recent: listRecent(10) });
});

app.post("/api/family/request", (req, res) => {
  const record = createApprovalRequest(req.body || {});
  res.status(201).json({ ok: true, approval: record });
});

app.get("/api/family/:id", (req, res) => {
  const record = getApproval(req.params.id);
  if (!record) return res.status(404).json({ error: "not found" });
  res.json({ approval: record });
});

app.post("/api/family/:id/decide", (req, res) => {
  const out = decideApproval(req.params.id, req.body || {});
  if (out.error === "not_found") return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.json({ ok: true, approval: out.record });
});


app.get("/", (_req, res) => {
  const llm = llmStatus();
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Paytm Scam Shield API</title>
  <style>
    body { font-family: DM Sans, Segoe UI, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; color: #132033; background: #f3f7fb; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(0,41,112,.08); }
    h1 { color: #002970; margin-top: 0; }
    code, a { color: #0a3a8a; }
    .ok { color: #16a34a; font-weight: 700; }
    .warn { color: #d97706; font-weight: 700; }
    li { margin: 6px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Paytm Scam Shield API</h1>
    <p>Server is running. This port is the <strong>backend API</strong>, not the UI.</p>
    <p>Status:
      <span class="${llm.live ? "ok" : "warn"}">${llm.live ? `Live LLM: ${llm.provider} (${llm.model})` : "Offline engine (no LLM key)"}</span>
    </p>
    <h3>Open the apps</h3>
    <ul>
      <li>Web UI: <a href="http://127.0.0.1:5173/">http://127.0.0.1:5173/</a> (or 5174 if busy)</li>
      <li>Health: <a href="/api/health">/api/health</a></li>
      <li>Analyze: <code>POST /api/analyze</code> with JSON <code>{"text":"..."}</code></li>
    </ul>
  </div>
</body>
</html>`);
});

app.get("/api/health", async (_req, res) => {
  const ml = await mlHealth();
  const fraudHealth = await fraudEngine.ml.health().catch(() => ({ available: false }));
  const llm = llmStatus();
  res.json({
    ok: true,
    llm,
    grokConfigured: llm.provider === "grok", // backward-compatible alias
    model: llm.model,
    offlineEngine: true,
    mlAvailable: Boolean(ml) || Boolean(fraudHealth?.available),
    ml: {
      textService: Boolean(ml),
      fraudService: Boolean(fraudHealth?.available),
      url: process.env.ML_SERVICE_URL || "http://127.0.0.1:8001",
      detail: fraudHealth || null,
    },
    familyApprovals: true,
    bind: "0.0.0.0",
  });
});

app.get("/api/ml/metrics", async (_req, res) => {
  const metrics = await mlMetrics();
  if (!metrics) return res.status(503).json({ error: "ML service offline" });
  res.json(metrics);
});

app.post("/api/transaction-risk", async (req, res) => {
  const b = req.body || {};
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "amount must be a non-negative number" });
  }
  const { upis, mobiles } = extractEntities(`${b.payee || ""}`);
  const complaints = COMPLAINT_REGISTRY.filter(
    (r) =>
      (r.type === "upi" && upis.includes(r.entity.toLowerCase())) ||
      (r.type === "mobile" && mobiles.includes(r.entity))
  ).reduce((n, r) => Math.max(n, r.complaints), 0);

  const payload = {
    amount,
    user_avg: Math.max(Number(b.user_avg) || 1000, 1),
    new_payee: Boolean(b.new_payee),
    hour: Number.isInteger(b.hour) ? Math.min(23, Math.max(0, b.hour)) : new Date().getHours(),
    velocity_1h: Math.max(0, Math.round(Number(b.velocity_1h) || 0)),
    payee_complaints: Math.max(complaints, Math.round(Number(b.payee_complaints) || 0)),
    collect_request: Boolean(b.collect_request),
  };
  const result = (await mlTransaction(payload)) || heuristicTransactionRisk(payload);
  res.json({ ...result, payee_complaints: payload.payee_complaints });
});

app.post("/api/reports", (req, res) => {
  const out = addReport(req.body);
  if (out.error) return res.status(400).json(out);
  res.status(201).json({ ok: true, report: out.report });
});

app.get("/api/reports/stats", (_req, res) => {
  res.json(getStats());
});

app.post("/api/analyze", async (req, res) => {
  const text = String(req.body?.text || "").trim().slice(0, 4000);
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }

  const ml = await mlPredict(text);
  const llm = llmStatus();
  const respond = (result, meta) => {
    const final = finalizeAnalysis(result, text, meta);
    const blended = blendWithMl(final, ml);
    return res.json({
      ...blended,
      ml_available: Boolean(ml),
      llm_provider: meta.llmProvider || llm.provider,
    });
  };

  if (!llmLive()) {
    return respond(pickMockByText(text), {
      source: "mock",
      message: ml
        ? "Rules + ML model (no LLM key)"
        : "Offline Shield engine (no LLM key)",
      llmProvider: "none",
    });
  }

  try {
    const out = await chatCompletion({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(text),
    });
    if (!out.ok) {
      console.error("LLM error:", out.provider, out.error, out.detail || "");
      return respond(pickMockByText(text), {
        source: "mock",
        message: `LLM (${out.provider}) failed (${out.error}) — offline response`,
        llmProvider: out.provider,
      });
    }
    const parsed = safeParseJson(out.content);
    if (!parsed) {
      return respond(pickMockByText(text), {
        source: "mock",
        message: `LLM (${out.provider}) parse failed — offline response`,
        llmProvider: out.provider,
      });
    }
    // Source tag for UI badge: groq | grok (LLM assist). Engines still own the blended verdict.
    return respond(parsed, {
      source: out.provider === "groq" ? "groq" : "grok",
      model: out.model,
      message: `Live ${out.provider} assist · engines keep the verdict`,
      llmProvider: out.provider,
    });
  } catch (err) {
    console.error("analyze error:", err);
    return respond(pickMockByText(text), {
      source: "mock",
      message: "Network error — offline response",
      llmProvider: llm.provider,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  const llm = llmStatus();
  console.log(`Scam Shield API on http://127.0.0.1:${PORT} (bound 0.0.0.0 — LAN phones OK)`);
  console.log(
    llm.live
      ? `LLM live · provider=${llm.provider} · model=${llm.model}`
      : "No LLM key — rules/ML offline path ON. Add GROQ_API_KEY (console.groq.com/keys) or GROK_API_KEY in server/.env"
  );
});
