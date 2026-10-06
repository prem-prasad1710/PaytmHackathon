import { pickMockByText } from "./mockResponses";

/**
 * Call backend analyze API; fall back to mocks if network/API fails.
 * Set VITE_USE_MOCK=true in .env to force offline demo mode.
 */
export async function analyzeText(text, { useMock = false } = {}) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error("Please paste a message to analyze");
  }

  const forceMock =
    useMock ||
    String(import.meta?.env?.VITE_USE_MOCK || "").toLowerCase() === "true";

  if (forceMock) {
    await delay(600);
    return pickMockByText(trimmed);
  }

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    if (!res.ok) {
      throw new Error(`API failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn("analyzeText fallback to mock:", err);
    await delay(400);
    return pickMockByText(trimmed);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
