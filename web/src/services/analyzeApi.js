import { pickMockByText, finalizeAnalysis } from "./mockResponses";

/**
 * Offline-first analyze:
 * 1) Try Grok API if enabled
 * 2) Always fall back to rich offline responses if Grok fails / missing key
 * 3) Always attach complaint alerts (additive)
 */
export async function analyzeText(text, { useMock = false } = {}) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error("Please paste a message to analyze");
  }

  const forceMock =
    useMock ||
    String(import.meta.env.VITE_USE_MOCK || "false").toLowerCase() === "true";

  if (forceMock) {
    await delay(450);
    return finalizeAnalysis(pickMockByText(trimmed), trimmed, {
      source: "mock",
      message: "Offline Shield engine",
    });
  }

  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const url = `${base}/api/analyze`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    if (!res.ok) throw new Error(`API failed with status ${res.status}`);
    const data = await res.json();
    // Hybrid server responses are already normalised, blended with ML and enriched.
    if (data.score_breakdown) {
      return { ...data, source: data.source || "mock" };
    }
    // Older servers: ensure complaint alert exists client-side too.
    return finalizeAnalysis(data, trimmed, {
      source: data.source || "grok",
      message: data.message,
      model: data.model,
    });
  } catch (err) {
    console.warn("analyzeText offline fallback:", err);
    await delay(300);
    return finalizeAnalysis(pickMockByText(trimmed), trimmed, {
      source: "mock",
      message: "Grok/API unavailable — offline response",
    });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
