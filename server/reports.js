import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPLAINT_REGISTRY } from "../shared/offlineEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "reports.json");

const STATES = new Set([
  "AP","AR","AS","BR","CG","GA","GJ","HR","HP","JH","KA","KL","MP","MH","MN","ML","MZ","NL","OD",
  "PB","RJ","SK","TN","TS","TR","UP","UK","WB","DL","JK","LA","CH","PY",
]);
const TYPES = new Set(["upi", "mobile", "qr", "link", "message"]);

let reports = [];

function load() {
  try {
    reports = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!Array.isArray(reports)) reports = [];
  } catch {
    reports = [];
  }
  for (const r of reports) syncRegistry(r);
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(reports.slice(-5000), null, 2));
}

function syncRegistry(r) {
  if (r.type !== "upi" && r.type !== "mobile") return;
  const entity = r.entity.toLowerCase();
  const row = COMPLAINT_REGISTRY.find((x) => x.type === r.type && x.entity.toLowerCase() === entity);
  if (row) {
    row.complaints += 1;
  } else {
    COMPLAINT_REGISTRY.push({
      entity,
      type: r.type,
      complaints: 1,
      label: r.category || "Community reported",
    });
  }
}

function clean(v, max = 200) {
  return String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, max);
}

export function addReport(input) {
  const type = TYPES.has(input?.type) ? input.type : "message";
  const entity = clean(input?.entity, 120);
  if (!entity) return { error: "entity is required" };
  const state = STATES.has(String(input?.state).toUpperCase()) ? String(input.state).toUpperCase() : null;
  const report = {
    id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    entity: type === "mobile" ? entity.replace(/\D/g, "").slice(-10) : entity.toLowerCase(),
    type,
    category: clean(input?.category, 60) || "Unspecified",
    note: clean(input?.note, 300),
    state,
    at: new Date().toISOString(),
  };
  reports.push(report);
  syncRegistry(report);
  persist();
  return { report };
}

export function getStats() {
  const byState = {};
  const byCategory = {};
  const entityCount = {};
  for (const r of reports) {
    if (r.state) byState[r.state] = (byState[r.state] || 0) + 1;
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    entityCount[r.entity] = (entityCount[r.entity] || 0) + 1;
  }
  const topEntities = Object.entries(entityCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([entity, count]) => ({ entity, count }));
  return {
    total: reports.length,
    byState,
    byCategory,
    topEntities,
    recent: reports.slice(-10).reverse().map(({ id, type, category, state, at }) => ({ id, type, category, state, at })),
  };
}

load();
