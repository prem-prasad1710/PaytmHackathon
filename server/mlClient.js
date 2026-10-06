const ML_URL = String(process.env.ML_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 2500);

async function mlFetch(path, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ML_URL}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`ML ${path} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function post(path, body) {
  return mlFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Each helper resolves to null when the ML service is down, so callers can degrade gracefully. */
export async function mlPredict(text) {
  try {
    return await post("/predict", { text });
  } catch {
    return null;
  }
}

export async function mlTransaction(payload) {
  try {
    return await post("/transaction", payload);
  } catch {
    return null;
  }
}

export async function mlMetrics() {
  try {
    return await mlFetch("/metrics");
  } catch {
    return null;
  }
}

export async function mlHealth() {
  try {
    return await mlFetch("/health");
  } catch {
    return null;
  }
}
