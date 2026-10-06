#!/usr/bin/env node
// Minimal-setup demo: API + web only, no Python. The fraud engine runs on its graph and rule
// engines and reports mlAvailable=false (no model is pretended). Needs only `npm run setup:js`.
//   ML_MODE=mock node scripts/dev-lite.mjs   -> additionally enables the labelled heuristic mock
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = { ...process.env, ML_SERVICE_ENABLED: process.env.ML_MODE === "mock" ? "true" : "false" };

const children = ["server", "web"].map((dir) =>
  spawn(npm, ["--prefix", dir, "run", "dev"], { cwd: root, env, stdio: "inherit" })
);
const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) => c.on("exit", stop));
