#!/usr/bin/env node
/**
 * Detached live stack — leaves ML + API + Vite running after this process exits.
 * Logs: logs/{ml,api,web}.log   PIDs: logs/live.pids   Stop: bash logs/STOP.sh
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logs = path.join(root, "logs");
fs.mkdirSync(logs, { recursive: true });

const pids = [];

function bg(name, cmd, args, cwd, envExtra = {}) {
  const logPath = path.join(logs, `${name}.log`);
  const out = fs.openSync(logPath, "a");
  const err = fs.openSync(logPath, "a");
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...envExtra },
    detached: true,
    stdio: ["ignore", out, err],
  });
  child.unref();
  pids.push({ name, pid: child.pid });
  fs.closeSync(out);
  fs.closeSync(err);
  console.log(`[live-bg] started ${name} pid=${child.pid} → logs/${name}.log`);
}

bg(
  "ml",
  process.execPath,
  [path.join(root, "scripts", "ml.mjs"), "serve"],
  root,
);
bg(
  "api",
  "npm",
  ["run", "start"],
  path.join(root, "server"),
  { HOST: "0.0.0.0", PORT: "8787", ML_SERVICE_URL: "http://127.0.0.1:8001" },
);
bg(
  "web",
  "npm",
  ["run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"],
  path.join(root, "web"),
  {
    VITE_USE_MOCK: "false",
    VITE_API_BASE_URL: "http://127.0.0.1:8787",
    VITE_ML_BASE_URL: "http://127.0.0.1:8001",
  },
);

fs.writeFileSync(
  path.join(logs, "live.pids"),
  pids.map((p) => `${p.name}=${p.pid}`).join("\n") + "\n",
);
fs.writeFileSync(
  path.join(logs, "STOP.sh"),
  `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/logs/live.pids" ]]; then
  while IFS='=' read -r name pid; do
    [[ -z "\${pid:-}" ]] && continue
    kill "$pid" 2>/dev/null || true
    # also kill process group children if any
    pkill -P "$pid" 2>/dev/null || true
  done < "$ROOT/logs/live.pids"
fi
lsof -ti:8787 -ti:8001 -ti:5173 2>/dev/null | xargs kill 2>/dev/null || true
echo "Stopped live stack (ports 8787/8001/5173)."
`,
);
fs.chmodSync(path.join(logs, "STOP.sh"), 0o755);

console.log("");
console.log("Live stack RUNNING in background.");
console.log("  Web:  http://127.0.0.1:5173/");
console.log("  API:  http://127.0.0.1:8787/api/health");
console.log("  ML:   http://127.0.0.1:8001/health");
console.log("  Stop: bash logs/STOP.sh");
console.log("  Logs: logs/{ml,api,web}.log");
