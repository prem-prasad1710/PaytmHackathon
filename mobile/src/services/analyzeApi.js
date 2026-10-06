import { pickMockByText, finalizeAnalysis } from "./mockResponses";

export async function analyzeText(text) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error("Please paste a message to analyze");
  }

  const forceMock =
    String(process.env.EXPO_PUBLIC_USE_MOCK || "false").toLowerCase() === "true";

  if (forceMock) {
    await delay(450);
    return finalizeAnalysis(pickMockByText(trimmed), trimmed, {
      source: "mock",
      message: "Offline Shield engine",
    });
  }

  const base = String(
    process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8787"
  ).replace(/\/$/, "");

  try {
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    if (!res.ok) throw new Error(`API failed with status ${res.status}`);
    const data = await res.json();
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
