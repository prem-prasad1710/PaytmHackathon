const base = () => String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${base()}/api/console${path}`, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (path === "/export.jsonl") {
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return res;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export const fetchCases = (params = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.decision) q.set("decision", params.decision);
  if (params.sort) q.set("sort", params.sort);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return request(`/cases${qs ? `?${qs}` : ""}`);
};

export const fetchCase = (id) => request(`/cases/${encodeURIComponent(id)}`);
export const fetchStats = () => request("/stats");
export const reviewCase = (id, body) => request(`/cases/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify(body) });
export const seedCases = (count = 25) => request("/seed", { method: "POST", body: JSON.stringify({ count }) });
export const exportFeedback = () => request("/export.jsonl");

export async function fetchMlHealth() {
  const res = await fetch(`${base()}/api/fraud/health`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}
