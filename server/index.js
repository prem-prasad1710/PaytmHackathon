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

const app = express();
const PORT = Number(process.env.PORT || 8787);
const GROK_API_URL = process.env.GROK_API_URL || "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = process.env.GROK_MODEL || "grok-4-latest";

if (String(process.env.ALLOW_INSECURE_TLS || "").toLowerCase() === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("ALLOW_INSECURE_TLS=true — TLS verification disabled");
}

function getApiKey() {
  const key = String(process.env.GROK_API_KEY || "").trim();
  if (!key) return null;
  if (/your-key|your_key|changeme|xxx|placeholder/i.test(key)) return null;
  return key;
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
const fraudEngine = new FraudEngine();
fraudEngine.warmUp();
app.use("/api/fraud", createFraudRouter(fraudEngine));

app.get("/", (_req, res) => {
  const grok = Boolean(getApiKey());
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
      <span class="${grok ? "ok" : "warn"}">${grok ? "Live Grok configured" : "Offline engine active (no Grok key)"}</span>
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
  res.json({
    ok: true,
    grokConfigured: Boolean(getApiKey()),
    model: GROK_MODEL,
    offlineEngine: true,
    mlAvailable: Boolean(await mlHealth()),
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
  const respond = (result, meta) => {
    const final = finalizeAnalysis(result, text, meta);
    return res.json({ ...blendWithMl(final, ml), ml_available: Boolean(ml) });
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    return respond(pickMockByText(text), {
      source: "mock",
      message: ml ? "Rules + ML model (no Grok key)" : "Offline Shield engine (no Grok key)",
    });
  }

  try {
    const grokRes = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(text) },
        ],
      }),
    });

    const rawBody = await grokRes.text();
    if (!grokRes.ok) {
      console.error("Grok API error:", grokRes.status, rawBody);
      return respond(pickMockByText(text), {
        source: "mock",
        message: `Grok failed (${grokRes.status}) — offline response`,
      });
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = null;
    }

    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = safeParseJson(content);
    if (!parsed) {
      return respond(pickMockByText(text), {
        source: "mock",
        message: "Grok parse failed — offline response",
      });
    }

    return respond(parsed, {
      source: "grok",
      model: data?.model || GROK_MODEL,
    });
  } catch (err) {
    console.error("analyze error:", err);
    return respond(pickMockByText(text), {
      source: "mock",
      message: "Network error — offline response",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Scam Shield API on http://127.0.0.1:${PORT}`);
  console.log(
    getApiKey()
      ? `Grok connected · model=${GROK_MODEL}`
      : "Offline engine active (no Grok key) — full mock responses ON"
  );
});
