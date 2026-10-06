export function extractPaymentMeta(text = "", result = null) {
  const amountMatch = text.match(/(?:₹|Rs\.?\s*)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
  const upiMatch = text.match(/([\w.-]+@[\w]+)/i);

  let amount = amountMatch ? `₹${amountMatch[1]}` : "₹842";
  let payee = "Official biller";

  const lower = text.toLowerCase();
  if (lower.includes("electricity") || lower.includes("biller")) {
    payee = "State Electricity Board";
  } else if (upiMatch) {
    payee = upiMatch[1];
  } else if (result?.risk === "High Risk") {
    payee = "Unknown / Suspicious";
  }

  return {
    amount,
    payee,
    summary: result?.hindi_summary || "Shield checked this payment.",
    risk: result?.risk || "Caution",
    safeToProceed: Boolean(result?.safe_to_proceed),
    text,
  };
}

export function resolvePrimaryAction(result) {
  if (!result) return "none";
  if (result.safe_to_proceed) return "confirm_pay";
  if (String(result.risk).toLowerCase().includes("high")) return "block";
  return "verify";
}

export function resolveSecondaryAction(result) {
  if (!result) return "none";
  if (result.safe_to_proceed) return "tips";
  if (String(result.risk).toLowerCase().includes("high")) return "report";
  return "continue_anyway";
}

export function riskColor(risk = "") {
  const value = risk.toLowerCase();
  if (value.includes("high")) return "#dc2626";
  if (value.includes("safe")) return "#16a34a";
  return "#d97706";
}
