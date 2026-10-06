export function riskClass(risk = "") {
  const value = risk.toLowerCase();
  if (value.includes("high")) return "high";
  if (value.includes("caution")) return "caution";
  if (value.includes("safe")) return "safe";
  return "caution";
}

export function riskColor(risk = "") {
  const cls = riskClass(risk);
  if (cls === "safe") return "#16a34a";
  if (cls === "high") return "#dc2626";
  return "#d97706";
}

export function primaryButtonClass(risk = "") {
  const cls = riskClass(risk);
  if (cls === "safe") return "btn btn-safe";
  if (cls === "high") return "btn btn-danger";
  return "btn btn-caution";
}
