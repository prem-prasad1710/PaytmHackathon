import { SEED_CATEGORIES, SEED_STATE_COUNTS } from "../data/threatSeed";
import { addLocalReport, getLocalReports } from "../utils/store";

const base = () => String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function getJson(path) {
  const res = await fetch(`${base()}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function submitReport({ entity, type, category, state, note }) {
  addLocalReport({ entity, type, category, state, note });
  try {
    const res = await fetch(`${base()}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, type, category, state, note }),
    });
    return { ok: true, synced: res.ok };
  } catch {
    return { ok: true, synced: false };
  }
}

/** Seed baseline + server reports + this device's reports. */
export async function fetchThreatStats() {
  let server = null;
  try {
    server = await getJson("/api/reports/stats");
  } catch {
    server = null;
  }
  const local = getLocalReports();

  const byState = { ...SEED_STATE_COUNTS };
  const addState = (code, n = 1) => {
    if (code) byState[code] = (byState[code] || 0) + n;
  };
  const categories = new Map(SEED_CATEGORIES.map((c) => [c.name, { ...c }]));
  const addCat = (name, n = 1) => {
    const row = categories.get(name) || { name, count: 0, trend: 0 };
    row.count += n;
    categories.set(name, row);
  };

  let liveTotal = 0;
  if (server) {
    for (const [code, n] of Object.entries(server.byState || {})) addState(code, n);
    for (const [name, n] of Object.entries(server.byCategory || {})) addCat(name, n);
    liveTotal += server.total || 0;
  } else {
    for (const r of local) {
      addState(r.state);
      addCat(r.category || "Other");
    }
    liveTotal += local.length;
  }

  return {
    byState,
    categories: [...categories.values()].sort((a, b) => b.count - a.count),
    liveTotal,
    seedTotal: Object.values(SEED_STATE_COUNTS).reduce((a, b) => a + b, 0),
    topEntities: server?.topEntities || [],
    recent: server?.recent || local.slice(0, 8).map((r) => ({ ...r, id: r.at })),
    serverOnline: Boolean(server),
  };
}
