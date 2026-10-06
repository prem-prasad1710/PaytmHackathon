const MAX_FIELD_LEN = 500;

const CHANNEL_LABELS = {
  call: "Phone call",
  sms: "SMS",
  whatsapp: "WhatsApp",
  qr: "QR code",
  "upi-request": "UPI collect request",
  link: "Link / website",
  other: "Other",
};

const CHANNEL_LABELS_HI = {
  call: "फ़ोन कॉल",
  sms: "SMS",
  whatsapp: "WhatsApp",
  qr: "QR कोड",
  "upi-request": "UPI कलेक्ट अनुरोध",
  link: "लिंक / वेबसाइट",
  other: "अन्य",
};

const PAYMENT_MODE_LABELS = {
  upi: "UPI",
  card: "Debit/Credit card",
  netbanking: "Net banking",
  wallet: "Wallet",
};

export function sanitizeInput(value, maxLen = MAX_FIELD_LEN) {
  if (value == null) return "";
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

export function formatInrAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function formatIstDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function maskAccountNumber(value) {
  const s = sanitizeInput(value, 40).replace(/\s/g, "");
  if (!s) return "";
  if (s.length <= 4) return "****";
  return `${"*".repeat(Math.min(s.length - 4, 8))}${s.slice(-4)}`;
}

export function timeSinceIncident(incidentAt, now = new Date()) {
  const start = new Date(incidentAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = now instanceof Date ? now : new Date(now);
  const ms = Math.max(0, end.getTime() - start.getTime());
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return { ms, label: `${days} day${days === 1 ? "" : "s"}, ${hours % 24} hr`, urgent: days === 0 && hours < 2 };
  if (hours > 0) return { ms, label: `${hours} hr ${minutes % 60} min`, urgent: hours < 2 };
  return { ms, label: `${minutes} min`, urgent: true };
}

function hasScammerId(data) {
  return Boolean(data.scammerPhone || data.scammerUpi || data.scammerUrl);
}

export function validateMissingFields(data) {
  const missing = [];
  if (!data.incidentAt) {
    missing.push({ field: "incidentAt", message: "When the incident happened", severity: "critical" });
  }
  if (!data.channel) {
    missing.push({ field: "channel", message: "How the scammer contacted you", severity: "critical" });
  }
  if (!hasScammerId(data)) {
    missing.push({
      field: "scammerId",
      message: "At least one scammer detail (phone, UPI ID, or link)",
      severity: "critical",
    });
  }
  const amount = Number(data.amountLost) || 0;
  if (amount > 0) {
    if (!data.paymentMode) {
      missing.push({ field: "paymentMode", message: "How you paid", severity: "critical" });
    }
    if (!sanitizeInput(data.txnRef)) {
      missing.push({ field: "txnRef", message: "Transaction ID / UTR", severity: "critical" });
    }
    if (!sanitizeInput(data.bank)) {
      missing.push({ field: "bank", message: "Bank or UPI app name", severity: "recommended" });
    }
  }
  if (!sanitizeInput(data.description)) {
    missing.push({ field: "description", message: "Brief description of what happened", severity: "recommended" });
  }
  return missing;
}

function channelLabel(channel, hi = false) {
  const map = hi ? CHANNEL_LABELS_HI : CHANNEL_LABELS;
  return map[channel] || (hi ? "अज्ञात" : "Unknown");
}

function paymentLabel(mode) {
  return PAYMENT_MODE_LABELS[mode] || mode || "—";
}

function evidenceLines(evidence = {}) {
  const items = [];
  if (evidence.chatScreenshots) items.push("Chat / message screenshots");
  if (evidence.paymentConfirmation) items.push("Payment confirmation screenshot");
  if (evidence.utr) items.push("UTR / transaction reference");
  if (evidence.callerNumberScreenshot) items.push("Caller number screenshot");
  if (evidence.bankSms) items.push("Bank SMS / email");
  return items;
}

export function buildScammerDetailsBlock(data) {
  const lines = [];
  if (data.scammerPhone) lines.push(`Phone: ${sanitizeInput(data.scammerPhone, 20)}`);
  if (data.scammerUpi) lines.push(`UPI ID: ${sanitizeInput(data.scammerUpi, 80)}`);
  if (data.scammerUrl) lines.push(`Link: ${sanitizeInput(data.scammerUrl, 200)}`);
  lines.push(`Channel: ${channelLabel(data.channel)}`);
  if (data.incidentAt) lines.push(`Incident time (IST): ${formatIstDateTime(data.incidentAt)}`);
  const amount = Number(data.amountLost) || 0;
  if (amount > 0) lines.push(`Amount: ${formatInrAmount(amount)}`);
  return lines.join("\n");
}

export function buildComplaintEnglish(data) {
  const amount = Number(data.amountLost) || 0;
  const desc = sanitizeInput(data.description, 800);
  const evidence = evidenceLines(data.evidence);
  const parts = [
    "CYBER FRAUD INCIDENT REPORT (guidance draft — not legal advice)",
    "",
    `Date of incident (IST): ${formatIstDateTime(data.incidentAt)}`,
    data.discoveredAt ? `Date discovered (IST): ${formatIstDateTime(data.discoveredAt)}` : null,
    `Mode of contact: ${channelLabel(data.channel)}`,
    "",
    "SUSPECT DETAILS:",
    data.scammerPhone ? `  Phone number: ${sanitizeInput(data.scammerPhone, 20)}` : null,
    data.scammerUpi ? `  UPI ID: ${sanitizeInput(data.scammerUpi, 80)}` : null,
    data.scammerUrl ? `  Website / link: ${sanitizeInput(data.scammerUrl, 200)}` : null,
    "",
    amount > 0 ? "FINANCIAL LOSS:" : "FINANCIAL LOSS: None reported (attempted fraud / narrowly avoided)",
    amount > 0 ? `  Amount lost: ${formatInrAmount(amount)}` : null,
    amount > 0 && data.paymentMode ? `  Payment mode: ${paymentLabel(data.paymentMode)}` : null,
    amount > 0 && data.txnRef ? `  Transaction ID / UTR: ${sanitizeInput(data.txnRef, 60)}` : null,
    amount > 0 && data.bank ? `  Bank / UPI app: ${sanitizeInput(data.bank, 80)}` : null,
    "",
    "INCIDENT DESCRIPTION:",
    desc || "  [Please describe what happened in your own words.]",
    "",
    evidence.length ? "EVIDENCE AVAILABLE:\n" + evidence.map((e) => `  - ${e}`).join("\n") : "EVIDENCE: [List screenshots, SMS, call records you have saved.]",
    "",
    "ACTION TAKEN:",
    "  - Contacted bank / UPI app to block card or UPI ID and raise dispute (if applicable).",
    "  - Reporting to National Cyber Crime Helpline 1930.",
    "  - Filing complaint at https://cybercrime.gov.in",
    "",
    "Note: This is a guidance draft for filing a complaint. Keep originals of all evidence.",
  ].filter((line) => line !== null);
  return parts.join("\n");
}

export function buildComplaintHindi(data) {
  const amount = Number(data.amountLost) || 0;
  const desc = sanitizeInput(data.description, 800);
  const evidence = evidenceLines(data.evidence);
  const evidenceHi = evidence.map((e) => {
    const map = {
      "Chat / message screenshots": "चैट / संदेश के स्क्रीनशॉट",
      "Payment confirmation screenshot": "भुगतान पुष्टि का स्क्रीनशॉट",
      "UTR / transaction reference": "UTR / लेनदेन संदर्भ",
      "Caller number screenshot": "कॉलर नंबर का स्क्रीनशॉट",
      "Bank SMS / email": "बैंक SMS / ईमेल",
    };
    return map[e] || e;
  });
  const parts = [
    "साइबर धोखाधड़ी की शिकायत (मार्गदर्शन प्रारूप — कानूनी सलाह नहीं)",
    "",
    `घटना की तारीख (IST): ${formatIstDateTime(data.incidentAt)}`,
    data.discoveredAt ? `पता चलने की तारीख (IST): ${formatIstDateTime(data.discoveredAt)}` : null,
    `संपर्क का माध्यम: ${channelLabel(data.channel, true)}`,
    "",
    "संदिग्ध व्यक्ति / धोखेबाज़ का विवरण:",
    data.scammerPhone ? `  फ़ोन नंबर: ${sanitizeInput(data.scammerPhone, 20)}` : null,
    data.scammerUpi ? `  UPI ID: ${sanitizeInput(data.scammerUpi, 80)}` : null,
    data.scammerUrl ? `  वेबसाइट / लिंक: ${sanitizeInput(data.scammerUrl, 200)}` : null,
    "",
    amount > 0 ? "वित्तीय नुकसान:" : "वित्तीय नुकसान: कोई रिपोर्ट नहीं (प्रयास / बचाव)",
    amount > 0 ? `  राशि: ${formatInrAmount(amount)}` : null,
    amount > 0 && data.paymentMode ? `  भुगतान का तरीका: ${paymentLabel(data.paymentMode)}` : null,
    amount > 0 && data.txnRef ? `  लेनदेन ID / UTR: ${sanitizeInput(data.txnRef, 60)}` : null,
    amount > 0 && data.bank ? `  बैंक / UPI ऐप: ${sanitizeInput(data.bank, 80)}` : null,
    "",
    "घटना का विवरण:",
    desc || "  [कृपया अपने शब्दों में बताएं क्या हुआ।]",
    "",
    evidenceHi.length
      ? "उपलब्ध साक्ष्य:\n" + evidenceHi.map((e) => `  - ${e}`).join("\n")
      : "साक्ष्य: [सहेजे गए स्क्रीनशॉट, SMS, कॉल रिकॉर्ड सूचीबद्ध करें।]",
    "",
    "की गई कार्रवाई:",
    "  - बैंक / UPI ऐप से कार्ड या UPI ID ब्लॉक और विवाद दर्ज करने का अनुरोध।",
    "  - राष्ट्रीय साइबर अपराध हेल्पलाइन 1930 पर रिपोर्ट।",
    "  - cybercrime.gov.in पर शिकायत दर्ज।",
    "",
    "नोट: यह शिकायत दर्ज करने के लिए मार्गदर्शन प्रारूप है। सभी साक्ष्य की मूल प्रति सुरक्षित रखें।",
  ].filter((line) => line !== null);
  return parts.join("\n");
}

export function buildBankDisputeEmail(data) {
  const amount = Number(data.amountLost) || 0;
  const subject = amount > 0
    ? `Dispute: Unauthorised transaction / cyber fraud — ${sanitizeInput(data.txnRef, 40) || "ref pending"}`
    : "Report: Attempted cyber fraud — request to block UPI / card";
  const body = [
    "Dear Customer Care,",
    "",
    "I am writing to report a cyber fraud incident and request immediate action. This is guidance — please follow your bank's dispute process.",
    "",
    `Incident date (IST): ${formatIstDateTime(data.incidentAt)}`,
    amount > 0 ? `Amount: ${formatInrAmount(amount)}` : "No payment completed (attempted fraud).",
    data.paymentMode ? `Payment mode: ${paymentLabel(data.paymentMode)}` : null,
    data.txnRef ? `Transaction ID / UTR: ${sanitizeInput(data.txnRef, 60)}` : null,
    data.scammerUpi ? `Beneficiary UPI ID: ${sanitizeInput(data.scammerUpi, 80)}` : null,
    data.scammerPhone ? `Scammer phone: ${sanitizeInput(data.scammerPhone, 20)}` : null,
    "",
    "Requested actions:",
    "1. Block my card / UPI ID if not already done.",
    amount > 0 ? "2. Raise a dispute for the unauthorised transaction and attempt to recall / freeze funds." : "2. Flag my account for enhanced monitoring.",
    "3. Share the dispute reference number and next steps.",
    "",
    "I have also reported to National Cyber Crime Helpline 1930 and will file at cybercrime.gov.in.",
    "Please check your bank's policy; RBI guidelines on customer protection for unauthorised electronic transactions generally depend on how quickly you report.",
    "",
    sanitizeInput(data.description, 600) || "[Brief description of the incident]",
    "",
    "Regards,",
    "[Your name]",
    "[Registered mobile / account number]",
  ]
    .filter((line) => line !== null)
    .join("\n");
  return { subject, body };
}

export function buildReportPack(data) {
  const incident = normalizeIncident(data);
  return {
    complaintEnglish: buildComplaintEnglish(incident),
    complaintHindi: buildComplaintHindi(incident),
    bankEmail: buildBankDisputeEmail(incident),
    scammerDetails: buildScammerDetailsBlock(incident),
    missingFields: validateMissingFields(incident),
    timeSince: incident.incidentAt ? timeSinceIncident(incident.incidentAt) : null,
  };
}

function normalizeIncident(data = {}) {
  return {
    incidentAt: data.incidentAt || "",
    discoveredAt: data.discoveredAt || "",
    channel: data.channel || "",
    scammerPhone: sanitizeInput(data.scammerPhone, 20),
    scammerUpi: sanitizeInput(data.scammerUpi, 80),
    scammerUrl: sanitizeInput(data.scammerUrl, 200),
    amountLost: Number(data.amountLost) || 0,
    paymentMode: data.paymentMode || "",
    txnRef: sanitizeInput(data.txnRef, 60),
    bank: sanitizeInput(data.bank, 80),
    description: sanitizeInput(data.description, 800),
    evidence: {
      chatScreenshots: Boolean(data.evidence?.chatScreenshots),
      paymentConfirmation: Boolean(data.evidence?.paymentConfirmation),
      utr: Boolean(data.evidence?.utr),
      callerNumberScreenshot: Boolean(data.evidence?.callerNumberScreenshot),
      bankSms: Boolean(data.evidence?.bankSms),
    },
  };
}

function guessChannelFromInput(input, kind) {
  const s = String(input || "").toLowerCase();
  if (kind === "qr") return "qr";
  if (/^https?:|www\./.test(s)) return "link";
  if (/whatsapp|wa\.me/.test(s)) return "whatsapp";
  if (/^\d{10}$/.test(s.replace(/\D/g, "").slice(-10))) return "call";
  if (s.includes("@")) return "upi-request";
  if (kind === "message") return "sms";
  return "other";
}

function extractPhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  const m = digits.match(/\d{10}/);
  return m ? m[0] : "";
}

function extractUpi(input) {
  const s = String(input || "");
  const m = s.match(/[\w.\-]+@[\w]+/i);
  return m ? m[0] : "";
}

function extractUrl(input) {
  const s = String(input || "");
  const m = s.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
  return m ? m[0] : "";
}

export function prefillFromCheck(check) {
  if (!check) return {};
  const input = check.input || "";
  return {
    incidentAt: check.at || new Date().toISOString(),
    channel: guessChannelFromInput(input, check.kind),
    scammerPhone: extractPhone(input),
    scammerUpi: extractUpi(input),
    scammerUrl: extractUrl(input),
    amountLost: Number(check.amount) || 0,
    description: sanitizeInput(check.summary || `Risk check: ${check.risk}. ${input}`, 400),
  };
}

export function prefillFromPayment(payment) {
  if (!payment) return {};
  return {
    incidentAt: payment.at || new Date().toISOString(),
    channel: "upi-request",
    scammerUpi: payment.payee || "",
    amountLost: Number(payment.amount) || 0,
    paymentMode: "upi",
    description: sanitizeInput(`Payment flagged as ${payment.risk}`, 200),
  };
}

export function prefillFromReport(report) {
  if (!report) return {};
  const typeMap = { upi: "upi-request", mobile: "call", link: "link", qr: "qr", message: "sms" };
  const entity = report.entity || "";
  return {
    incidentAt: report.at || new Date().toISOString(),
    channel: typeMap[report.type] || "other",
    scammerPhone: report.type === "mobile" ? entity : extractPhone(entity),
    scammerUpi: report.type === "upi" ? entity : extractUpi(entity),
    scammerUrl: report.type === "link" ? entity : extractUrl(entity),
    description: sanitizeInput([report.category, report.note].filter(Boolean).join(". "), 400),
  };
}

export function prefillFromRouterState(state = {}) {
  if (!state || typeof state !== "object") return {};
  const out = { description: sanitizeInput(state.summary, 400) };
  if (state.payee) out.scammerUpi = sanitizeInput(state.payee, 80);
  if (state.amount) out.amountLost = Number(state.amount) || 0;
  if (state.source === "call") out.channel = "call";
  else if (state.source === "blocked") out.channel = "upi-request";
  else if (state.source === "check") out.channel = "other";
  if (!out.incidentAt) out.incidentAt = new Date().toISOString();
  return out;
}

export function mergePrefill(...sources) {
  const merged = {};
  for (const src of sources) {
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      if (v !== undefined && v !== "" && v !== 0) merged[k] = v;
    }
  }
  return merged;
}

export function listHistoryPickerItems(checks = [], payments = [], reports = []) {
  const items = [];
  for (const c of checks.slice(0, 15)) {
    items.push({
      id: c.id,
      kind: "check",
      at: c.at,
      label: c.input?.slice(0, 60) || "Check",
      risk: c.risk,
      source: c,
    });
  }
  for (const p of payments.slice(0, 5)) {
    items.push({
      id: `p_${p.at}`,
      kind: "payment",
      at: p.at,
      label: `${p.payee || "Payment"} — ${formatInrAmount(p.amount)}`,
      risk: p.risk,
      source: p,
    });
  }
  for (const r of reports.slice(0, 5)) {
    items.push({
      id: `r_${r.at}`,
      kind: "report",
      at: r.at,
      label: r.entity || "Report",
      risk: r.category,
      source: r,
    });
  }
  return items.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20);
}

export function prefillFromPickerItem(item) {
  if (!item) return {};
  if (item.kind === "check") return prefillFromCheck(item.source);
  if (item.kind === "payment") return prefillFromPayment(item.source);
  if (item.kind === "report") return prefillFromReport(item.source);
  return {};
}

export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const ACTION_STEPS = [
  { id: "bank", label: "Call your bank / UPI app — block card or UPI ID and raise a dispute" },
  { id: "helpline", label: "Call National Cyber Crime Helpline 1930 with the details below" },
  { id: "portal", label: "File a complaint at cybercrime.gov.in" },
  { id: "evidence", label: "Save all evidence (screenshots, UTR, SMS, call logs)" },
  { id: "secure", label: "Change PINs/passwords; watch for follow-up scams" },
];

export const EVIDENCE_ITEMS = [
  { key: "chatScreenshots", label: "Chat / message screenshots" },
  { key: "paymentConfirmation", label: "Payment confirmation" },
  { key: "utr", label: "UTR / transaction ID" },
  { key: "callerNumberScreenshot", label: "Caller number screenshot" },
  { key: "bankSms", label: "Bank SMS / email" },
];

export { CHANNEL_LABELS, PAYMENT_MODE_LABELS };
