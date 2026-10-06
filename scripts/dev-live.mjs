#!/usr/bin/env node
/**
 * Live hackathon stack: ML (:8001) + API (:8787) + Vite web (:5173)
 * Logs stream with prefixes. Ctrl+C stops all.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logsDir = path.join(root, "logs");
mkdirSync(logsDir, { recursive: true });

const node = process.execPath;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH || ""}`,
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || "http://127.0.0.1:8001",
  ML_SERVICE_ENABLED: process.env.ML_SERVICE_ENABLED || "true",
  PORT: process.env.PORT || "8787",
};

const kids = [];
function start(name, command, args, cwd, color) {
  const logPath = path.join(logsDir, `${name}.log`);
  const out = createWriteStream(logPath, { flags: "a" });
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  const tag = (buf, stream) => {
    const lines = buf.toString().split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      const msg = `[${name}] ${line}\n`;
      stream.write(msg);
      out.write(msg);
    }
  };
  child.stdout.on("data", (d) => tag(d, process.stdout));
  child.stderr.on("data", (d) => tag(d, process.stderr));
  child.on("exit", (code) => {
    console.log(`[${name}] exited code=${code}`);
  });
  kids.push(child);
  console.log(`[${name}] started pid=${child.pid} · log=${logPath}`);
  return child;
}

console.log("Paytm Scam Shield · LIVE stack");
console.log("  ML     http://127.0.0.1:8001");
console.log("  API    http://127.0.0.1:8787  (0.0.0.0)");
console.log("  Web    http://127.0.0.1:5173");
console.log("  Health http://127.0.0.1:8787/api/health");
console.log("Logs in", logsDir);

start("ml", node, ["scripts/ml.mjs", "serve"], root);
setTimeout(() => {
  start("api", npm, ["--prefix", "server", "run", "start"], root);
}, 1500);
setTimeout(() => {
  start("web", npm, ["--prefix", "web", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"], root);
}, 2500);

function shutdown() {
  console.log("\nStopping live stack…");
  for (const c of kids) {
    try {
      c.kill("SIGTERM");
    } catch {}
  }
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
