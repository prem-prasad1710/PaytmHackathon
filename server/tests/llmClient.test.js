import test from "node:test";
import assert from "node:assert/strict";
import { resolveLlmConfig, llmStatus, chatCompletion } from "../llmClient.js";

test("resolveLlmConfig prefers groq when both keys set and provider unset", () => {
  const cfg = resolveLlmConfig({
    GROQ_API_KEY: "gsk_live_test_key_abc",
    GROK_API_KEY: "xai-live_test_key_abc",
  });
  assert.equal(cfg.provider, "groq");
  assert.match(cfg.url, /groq.com/);
  assert.equal(cfg.model, "llama-3.3-70b-versatile");
});

test("resolveLlmConfig respects LLM_PROVIDER=grok", () => {
  const cfg = resolveLlmConfig({
    LLM_PROVIDER: "grok",
    GROQ_API_KEY: "gsk_live_test_key_abc",
    GROK_API_KEY: "xai-live_test_key_abc",
    GROK_MODEL: "grok-4-latest",
  });
  assert.equal(cfg.provider, "grok");
  assert.match(cfg.url, /x\.ai/);
});

test("resolveLlmConfig returns none without keys", () => {
  const cfg = resolveLlmConfig({ LLM_PROVIDER: "groq" });
  assert.equal(cfg.provider, "none");
  assert.equal(llmStatus({}).live, false);
});

test("chatCompletion uses OpenAI-compatible payload and parses content (mocked)", async () => {
  let seen;
  const fakeFetch = async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          model: "llama-3.3-70b-versatile",
          choices: [{ message: { content: '{"risk":"Caution","score":40}' } }],
        });
      },
    };
  };
  const out = await chatCompletion({
    system: "sys",
    user: "usr",
    env: { GROQ_API_KEY: "gsk_live_test_key_abc", GROQ_MODEL: "llama-3.3-70b-versatile" },
    fetchImpl: fakeFetch,
  });
  assert.equal(out.ok, true);
  assert.equal(out.provider, "groq");
  assert.match(seen.url, /api\.groq\.com/);
  assert.equal(seen.body.model, "llama-3.3-70b-versatile");
  assert.match(seen.auth, /^Bearer gsk_/);
  assert.match(out.content, /Caution/);
});

test("chatCompletion falls back on HTTP error without throwing", async () => {
  const out = await chatCompletion({
    system: "s",
    user: "u",
    env: { GROQ_API_KEY: "gsk_live_test_key_abc" },
    fetchImpl: async () => ({ ok: false, status: 401, async text() { return "nope"; } }),
  });
  assert.equal(out.ok, false);
  assert.equal(out.error, "http_401");
});
