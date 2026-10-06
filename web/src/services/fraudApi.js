const base = () => String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(path, options) {
  const res = await fetch(`${base()}/api/fraud${path}`, {
    ...options,
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export const fetchOverview = () => request("/overview");
export const runScenario = (name) => request(`/scenario/${name}`, { method: "POST", body: "{}" });
export const nextStream = (count = 1) => request("/stream/next", { method: "POST", body: JSON.stringify({ count }) });
export const fetchNetwork = (accountId) => request(`/network/${encodeURIComponent(accountId)}`);
export const resetLab = () => request("/reset", { method: "POST", body: "{}" });
