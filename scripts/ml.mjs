#!/usr/bin/env node
// Cross-platform helper for the Python ML service.
//   node scripts/ml.mjs setup     -> create venv, install deps, build dataset, train every model
//   node scripts/ml.mjs dataset   -> regenerate the synthetic transaction dataset
//   node scripts/ml.mjs train     -> retrain text + fraud models (and re-evaluate)
//   node scripts/ml.mjs evaluate  -> re-run evaluation of the registered fraud model
//   node scripts/ml.mjs serve     -> start the FastAPI service (default :8001), training first if needed
//   node scripts/ml.mjs test      -> run the Python test-suite
import { spawnSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mlDir = path.join(root, "ml");
const isWin = process.platform === "win32";
const venvPython = path.join(mlDir, ".venv", isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python");
const port = process.env.ML_PORT || "8001";

function systemPython() {
  for (const cmd of isWin ? ["python", "py"] : ["python3", "python"]) {
    if (spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0) return cmd;
  }
  console.error("Python 3.10+ is required but was not found on PATH.");
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: mlDir, stdio: "inherit", ...opts });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function requireVenv() {
  if (!existsSync(venvPython)) {
    console.error("ML environment missing. Run: npm run setup:ml");
    process.exit(1);
  }
}

const textTrained = () => existsSync(path.join(mlDir, "text_model", "artifacts", "text_model.joblib"));
const fraudTrained = () => existsSync(path.join(mlDir, "models", "v1", "metadata.json"));
const trainText = () => run(venvPython, ["text_model/train.py"]);
const makeDataset = () => run(venvPython, ["-m", "dataset.generate_dataset"]);
const trainFraud = () => run(venvPython, ["-m", "training.train_model"]);

const command = process.argv[2];

if (command === "setup") {
  if (!existsSync(venvPython)) run(systemPython(), ["-m", "venv", ".venv"]);
  run(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"]);
  trainText();
  makeDataset();
  trainFraud();
} else if (command === "dataset") {
  requireVenv();
  makeDataset();
} else if (command === "train") {
  requireVenv();
  trainText();
  makeDataset();
  trainFraud();
} else if (command === "evaluate") {
  requireVenv();
  run(venvPython, ["-m", "training.evaluate_model"]);
} else if (command === "test") {
  requireVenv();
  run(venvPython, ["-m", "pytest", "tests", "-q"]);
} else if (command === "serve") {
  requireVenv();
  if (!textTrained()) trainText();
  if (!fraudTrained()) {
    makeDataset();
    trainFraud();
  }
  const child = spawn(venvPython, ["-m", "uvicorn", "inference.model_service:app", "--port", port], {
    cwd: mlDir,
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
} else {
  console.error("Usage: node scripts/ml.mjs <setup|dataset|train|evaluate|test|serve>");
  process.exit(1);
}
