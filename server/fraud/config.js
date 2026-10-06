const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function loadFraudConfig(env = process.env) {
  const weights = {
    mlWeight: num(env.RISK_ML_WEIGHT, 0.4),
    graphWeight: num(env.RISK_GRAPH_WEIGHT, 0.35),
    ruleWeight: num(env.RISK_RULE_WEIGHT, 0.25),
  };
  return {
    ml: {
      url: String(env.ML_SERVICE_URL || env.ML_URL || "http://localhost:8001").replace(/\/$/, ""),
      enabled: String(env.ML_SERVICE_ENABLED ?? "true").toLowerCase() !== "false",
      timeoutMs: num(env.ML_TIMEOUT_MS, 2500),
      mode: String(env.ML_MODE || "python").toLowerCase(),
    },
    weights,
    thresholds: {
      warning: num(env.RISK_WARNING_THRESHOLD, 35),
      block: num(env.RISK_BLOCK_THRESHOLD, 70),
      critical: num(env.RISK_CRITICAL_THRESHOLD, 85),
    },
    alarmFloor: {
      min: num(env.RISK_ALARM_MIN, 60),
      factor: num(env.RISK_ALARM_FACTOR, 0.6),
    },
    overrides: {
      extremeVelocity5m: num(env.RISK_EXTREME_VELOCITY_5M, 20),
      multipleConfirmedEntities: num(env.RISK_MULTI_CONFIRMED, 2),
    },
    simulator: { seed: num(env.FRAUD_SIM_SEED, 2026) },
  };
}
