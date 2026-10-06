import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const WORLD_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../shared/fraudDemoWorld.json");

/** Fixed virtual "now" so demo scenarios are reproducible regardless of wall-clock time. */
export const WORLD_NOW = 1_800_000_000;

let cached = null;

export function loadWorld(file = WORLD_PATH) {
  if (cached && file === WORLD_PATH) return cached;
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const events = raw.events
    .map(({ relTs, ...rest }) => ({ ...rest, ts: WORLD_NOW + relTs }))
    .sort((a, b) => a.ts - b.ts);
  const world = { ...raw, events, now: WORLD_NOW };
  if (file === WORLD_PATH) cached = world;
  return world;
}
