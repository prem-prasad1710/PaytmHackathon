#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logs = path.join(root, "logs");
mkdirSync(logs, { recursive: true });
const node = process.execPath;
const env = {
  ...process.env,
  PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH || ""}`,
  ML_SERVICE_URL: "http://127.0.0.1:8001",
  ML_SERVICE_ENABLED: "true",
  PORT: "8787",
};

function bg(name, args, cwd) {
  const log = path.join(logs, `${name}.log`);
  const out = createWriteStream(log, { flags: "a" });
  const child = spawn(node, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  writeFileSync(path.join(logs, `${name}.pid`), String(child.pid));
  console.log(`${name} pid=${child.pid} log=${log}`);
  return child.pid;
}

// ML via ml.mjs serve
bg("ml", ["scripts/ml.mjs", "serve"], root);
setTimeout(() => {
  const npmCli = path.join(path.dirname(node), "npm");
  // start server with node directly
  const sp = spawn(node, ["index.js"], {
    cwd: path.join(root, "server"),
    env,
    detached: true,
    stdio: ["ignore", createWriteStream(path.join(logs, "api.log"), { flags: "a" }), createWriteStream(path.join(logs, "api.log"), { flags: "a" })],
  });
  sp.unref();
  writeFileSync(path.join(logs, "api.pid"), String(sp.pid));
  console.log(`api pid=${sp.pid} log=${path.join(logs, "api.log")}`);
}, 2000);
setTimeout(() => {
  const viteBin = path.join(root, "web", "node_modules", "vite", "bin", "vite.js");
  const wp = spawn(node, [viteBin, "--host", "0.0.0.0", "--port", "5173"], {
    cwd: path.join(root, "web"),
    env,
    detached: true,
    stdio: ["ignore", createWriteStream(path.join(logs, "web.log"), { flags: "a" }), createWriteStream(path.join(logs, "web.log"), { flags: "a" })],
  });
  wp.unref();
  writeFileSync(path.join(logs, "web.pid"), String(wp.pid));
  console.log(`web pid=${wp.pid} log=${path.join(logs, "web.log")}`);
  writeFileSync(
    path.join(logs, "STOP.sh"),
    `#!/bin/bash
cd "$(dirname "$0")/.."
for f in logs/ml.pid logs/api.pid logs/web.pid; do
  if [ -f "$f" ]; then kill "$(cat "$f")" 2>/dev/null || true; fi
done
pkill -f 'uvicorn inference.model_service' 2>/dev/null || true
pkill -f 'Paytm-Scam-Shield-Hackathon/server/index.js' 2>/dev/null || true
pkill -f 'vite --host 0.0.0.0 --port 5173' 2>/dev/null || true
echo stopped
`
  );
  console.log("Stop with: bash logs/STOP.sh");
}, 3500);
