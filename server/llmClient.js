/**
 * Provider-agnostic LLM client (Groq / Grok / none).
 * Used only for analyze assist / explanation rephrase — never changes fraud verdicts.
 */

const PLACEHOLDER = /your-key|your_key|changeme|xxx|placeholder|^$/i;

function cleanKey(raw) {
  const key = String(raw || "").trim();
  if (!key || PLACEHOLDER.test(key)) return null;
  return key;
}

/**
 * Resolve which provider to use from env.
 * Default: groq if GROQ_API_KEY set, else grok if GROK_API_KEY set, else none.
 */
export function resolveLlmConfig(env = process.env) {
  const groqKey = cleanKey(env.GROQ_API_KEY);
  const grokKey = cleanKey(env.GROK_API_KEY);
  const forced = String(env.LLM_PROVIDER || "").trim().toLowerCase();

  let provider = "none";
  if (forced === "none") provider = "none";
  else if (forced === "groq" && groqKey) provider = "groq";
  else if (forced === "grok" && grokKey) provider = "grok";
  else if (forced === "groq" || forced === "grok") provider = "none"; // forced but missing key
  else if (groqKey) provider = "groq";
  else if (grokKey) provider = "grok";

  if (provider === "groq") {
    return {
      provider: "groq",
      apiKey: groqKey,
      model: String(env.GROQ_MODEL || "llama-3.3-70b-versatile").trim() || "llama-3.3-70b-versatile",
      url: String(env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions").trim(),
      timeoutMs: Number(env.LLM_TIMEOUT_MS || 12000),
    };
  }
  if (provider === "grok") {
    return {
      provider: "grok",
      apiKey: grokKey,
      model: String(env.GROK_MODEL || "grok-4-latest").trim() || "grok-4-latest",
      url: String(env.GROK_API_URL || "https://api.x.ai/v1/chat/completions").trim(),
      timeoutMs: Number(env.LLM_TIMEOUT_MS || 12000),
    };
  }
  return {
    provider: "none",
    apiKey: null,
    model: null,
    url: null,
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 12000),
  };
}

export function llmStatus(env = process.env) {
  const cfg = resolveLlmConfig(env);
  return {
    provider: cfg.provider,
    configured: cfg.provider !== "none",
    live: cfg.provider !== "none",
    model: cfg.model,
    note:
      cfg.provider === "groq"
        ? "Live Groq (OpenAI-compatible) — may rephrase only; verdicts stay engine-owned"
        : cfg.provider === "grok"
          ? "Live Grok (xAI) — may rephrase only; verdicts stay engine-owned"
          : "No LLM key — offline templates / rules + ML. Set GROQ_API_KEY or GROK_API_KEY in server/.env",
  };
}

/**
 * OpenAI-compatible chat completions call.
 * @returns {{ ok: true, content: string, model: string, provider: string } | { ok: false, error: string, provider: string }}
 */
export async function chatCompletion({ system, user, env = process.env, fetchImpl = fetch } = {}) {
  const cfg = resolveLlmConfig(env);
  if (cfg.provider === "none") {
    return { ok: false, error: "llm_not_configured", provider: "none" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: ctrl.signal,
    });
    const rawBody = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: `http_${res.status}`,
        provider: cfg.provider,
        detail: rawBody.slice(0, 240),
      };
    }
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      return { ok: false, error: "invalid_json", provider: cfg.provider };
    }
    const content = data?.choices?.[0]?.message?.content || "";
    if (!content) {
      return { ok: false, error: "empty_content", provider: cfg.provider };
    }
    return {
      ok: true,
      content,
      model: data?.model || cfg.model,
      provider: cfg.provider,
    };
  } catch (err) {
    const msg = err?.name === "AbortError" ? "timeout" : err?.message || "network_error";
    return { ok: false, error: msg, provider: cfg.provider };
  } finally {
    clearTimeout(timer);
  }
}
