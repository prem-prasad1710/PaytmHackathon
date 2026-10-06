import { COMPLAINT_REGISTRY } from "../services/offlineEngine";
import { getLocalReports } from "./store";

export const KNOWN_HANDLES = new Set([
  "paytm", "ptys", "ptyes", "pthdfc", "ptsbi", "okhdfcbank", "okicici", "oksbi", "okaxis", "ybl", "ibl", "axl",
  "apl", "upi", "sbi", "hdfcbank", "icici", "axisbank", "pnb", "boi", "cnrb", "barodampay", "kotak", "federal",
  "idfcbank", "indus", "yesbank", "airtel", "jio", "fbl", "aubank", "rbl", "ikwik", "freecharge", "postbank",
]);

const OFFICIAL_DOMAINS = {
  paytm: ["paytm.com", "paytmbank.com", "paytm.in"],
  npci: ["npci.org.in"],
  sbi: ["sbi.co.in", "onlinesbi.sbi", "sbi.bank.in"],
  hdfc: ["hdfcbank.com"],
  icici: ["icicibank.com"],
  axis: ["axisbank.com"],
  phonepe: ["phonepe.com"],
  gpay: ["pay.google.com", "google.com"],
  bharatpe: ["bharatpe.com"],
};

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "cutt.ly", "rb.gy", "t.co", "goo.gl", "is.gd", "shorturl.at", "ow.ly", "tiny.cc",
  "wa.me", "t.me", "rebrand.ly", "s.id", "qrco.de", "qr.link", "linktr.ee",
]);

const RISKY_TLDS = new Set([
  "xyz", "top", "click", "icu", "live", "buzz", "monster", "cfd", "sbs", "rest", "gq", "tk", "ml", "ga", "cf",
  "work", "support", "help", "loan", "win", "bid", "cam", "quest", "zip", "mov",
]);

const AUTHORITY_WORDS =
  /(support|help\s?desk|helpdesk|customer\s?care|refund|cashback|reward|kyc|officer|police|bank|govt|government|official|verification|claim|prize|lottery)/i;
const RECEIVE_WORDS = /(refund|cashback|reward|receive|prize|lottery|claim|reversal|winning|won|credit|bonus|gift)/i;

const WEIGHT = { high: 40, medium: 20, low: 8, info: 0, ok: 0 };

function finding(id, severity, title, detail) {
  return { id, severity, title, detail };
}

export function lookupComplaints(entity) {
  const key = String(entity || "").toLowerCase().trim();
  if (!key) return 0;
  let count = 0;
  for (const row of COMPLAINT_REGISTRY) {
    if (row.entity.toLowerCase() === key) count = Math.max(count, row.complaints);
  }
  const local = getLocalReports().filter((r) => String(r.entity).toLowerCase() === key).length;
  return count + local;
}

export function parseUpiUri(raw) {
  const m = String(raw).trim().match(/^upi:\/\/(pay|collect|mandate)\/?\??(.*)$/i);
  if (!m) return null;
  const params = {};
  for (const [k, v] of new URLSearchParams(m[2])) params[k.toLowerCase()] = v;
  return { action: m[1].toLowerCase(), params };
}

function registrableDomain(host) {
  const labels = host.toLowerCase().split(".");
  const twoPart = ["co.in", "org.in", "gov.in", "net.in", "ac.in", "com.au", "co.uk"];
  const lastTwo = labels.slice(-2).join(".");
  if (twoPart.includes(lastTwo) && labels.length >= 3) return labels.slice(-3).join(".");
  return lastTwo;
}

function analyzeUpi(raw, parsed) {
  const { action, params } = parsed;
  const findings = [];
  const pa = (params.pa || "").trim();
  const pn = (params.pn || "").trim();
  const tn = (params.tn || "").trim();
  const am = params.am ? Number(params.am) : null;
  const handle = pa.includes("@") ? pa.split("@")[1].toLowerCase() : "";
  const local = pa.includes("@") ? pa.split("@")[0] : pa;

  if (action === "collect") {
    findings.push(
      finding(
        "collect_request",
        "high",
        "This QR sends a COLLECT request",
        "Collect requests pull money OUT of your account. You never need to scan or approve anything to receive money."
      )
    );
  }

  if (!pa) {
    findings.push(finding("no_payee", "high", "No payee UPI ID inside the QR", "A valid payment QR always contains a payee address (pa)."));
  }

  if (tn && RECEIVE_WORDS.test(tn)) {
    findings.push(
      finding(
        "receive_bait",
        "high",
        `Payment note promises money: "${tn}"`,
        "Scammers disguise a payment as a refund/cashback/reward. Scanning a QR always means YOU pay."
      )
    );
  }

  if (am && Number.isFinite(am)) {
    if (am >= 10000) {
      findings.push(finding("large_amount", "medium", `Large pre-filled amount: ₹${am.toLocaleString("en-IN")}`, "Confirm the exact amount with the person or shop before approving."));
    } else {
      findings.push(finding("prefilled_amount", "info", `Amount pre-filled: ₹${am.toLocaleString("en-IN")}`, "Check it matches your bill."));
    }
  }

  if (!pn) {
    findings.push(finding("no_name", "medium", "No payee name inside the QR", "Genuine merchant QR codes normally include the business name."));
  } else if (AUTHORITY_WORDS.test(pn)) {
    findings.push(finding("authority_name", "medium", `Payee name looks like an authority: "${pn}"`, "Scammers pick names like 'Support', 'Refund' or 'KYC' to look official."));
  }

  if (handle && !KNOWN_HANDLES.has(handle)) {
    findings.push(finding("unknown_handle", "medium", `Unrecognised UPI handle @${handle}`, "Not in the list of common UPI apps/banks. Double-check the ID."));
  }

  if (pn && local && !/^\d+$/.test(local)) {
    const tokens = pn.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    const lc = local.toLowerCase();
    if (tokens.length && !tokens.some((t) => lc.includes(t) || t.includes(lc.slice(0, 4)))) {
      findings.push(finding("name_mismatch", "low", "Name and UPI ID do not resemble each other", "Compare the name shown on your UPI app with the board at the shop."));
    }
  }

  if (params.url) {
    findings.push(finding("external_url", "medium", "QR contains an external link", "Payment QR codes should not need a website. Do not open it."));
  }

  const complaints = lookupComplaints(pa);
  if (complaints > 0) {
    findings.push(
      finding(
        "community_flagged",
        "high",
        `${pa} has ${complaints} community complaint${complaints > 1 ? "s" : ""}`,
        "Other users reported this UPI ID."
      )
    );
  }

  return {
    kind: "upi",
    fields: { action, pa, pn, am, tn, handle, cu: params.cu || "INR", mc: params.mc || "" },
    findings,
  };
}

function analyzeUrl(raw) {
  const findings = [];
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const reg = registrableDomain(host);
  const tld = host.split(".").pop();

  if (url.protocol === "http:") findings.push(finding("http", "medium", "Link is not encrypted (http)", "Genuine payment sites use https."));
  if (SHORTENERS.has(reg) || SHORTENERS.has(host)) {
    findings.push(finding("shortener", "high", `Shortened / redirect link (${host})`, "Short links hide the real destination. Banks and Paytm do not send QR codes that open short links."));
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) findings.push(finding("ip_host", "high", "Link uses a raw IP address", "Legitimate services use proper domain names."));
  if (host.includes("xn--")) findings.push(finding("punycode", "high", "Look-alike (punycode) domain", "Characters may imitate a real brand."));
  if (url.username) findings.push(finding("userinfo", "high", "Link contains '@' trick", "Everything before @ is ignored; real destination is after it."));
  if (RISKY_TLDS.has(tld)) findings.push(finding("risky_tld", "medium", `Risky domain ending .${tld}`, "Frequently abused for throw-away phishing sites."));
  if ((host.match(/-/g) || []).length >= 2) findings.push(finding("hyphens", "low", "Many hyphens in the domain", "Often used in look-alike domains."));

  for (const [brand, domains] of Object.entries(OFFICIAL_DOMAINS)) {
    if (host.includes(brand) && !domains.includes(reg)) {
      findings.push(finding("brand_spoof", "high", `Pretends to be ${brand} but domain is ${reg}`, `Official ${brand} domains: ${domains.join(", ")}.`));
      break;
    }
  }
  if (/kyc|verify|reward|refund|claim|update|secure|login|bonus/i.test(url.pathname + url.search + host)) {
    findings.push(finding("bait_words", "medium", "Link uses urgency / bait words", "Words like verify, kyc, refund and claim are typical of phishing pages."));
  }
  if (!findings.length) findings.push(finding("unknown_site", "low", `Opens ${host}`, "No obvious red flags, but never enter PIN/OTP/card details after scanning a QR."));

  return { kind: "url", fields: { host, domain: reg, url: raw }, findings };
}

function analyzeOther(raw) {
  const lower = raw.trim().toLowerCase();
  const findings = [];
  if (lower.startsWith("tel:")) findings.push(finding("tel", "medium", "QR starts a phone call", "Do not call numbers from QR codes you do not trust."));
  else if (lower.startsWith("sms:") || lower.startsWith("smsto:")) findings.push(finding("sms", "medium", "QR pre-fills an SMS", "Premium-rate or subscription traps use this."));
  else if (lower.startsWith("wifi:")) findings.push(finding("wifi", "medium", "QR joins a Wi-Fi network", "Public hotspots can be rogue."));
  else if (lower.startsWith("bitcoin:") || lower.startsWith("ethereum:")) findings.push(finding("crypto", "high", "Crypto payment QR", "Crypto payments cannot be reversed."));
  else if (lower.startsWith("mailto:")) findings.push(finding("mail", "low", "QR composes an email", ""));
  else return null;
  return { kind: "other", fields: { payload: raw }, findings };
}

function scoreOf(findings) {
  const s = findings.reduce((n, f) => n + WEIGHT[f.severity], 5);
  return Math.min(100, s);
}

function riskOf(score, findings) {
  if (findings.some((f) => f.severity === "high") || score >= 70) return "High Risk";
  if (score >= 25) return "Caution";
  return "Safe";
}

/**
 * Returns null when the payload is plain text that should go through the
 * text/ML pipeline; otherwise a result in the same shape as /api/analyze.
 */
export function analyzeQrPayload(raw) {
  const payload = String(raw || "").trim();
  if (!payload) return null;

  let base = null;
  const upi = parseUpiUri(payload);
  if (upi) base = analyzeUpi(payload, upi);
  else if (/^https?:\/\//i.test(payload)) base = analyzeUrl(payload);
  else base = analyzeOther(payload);
  if (!base) return null;

  const score = scoreOf(base.findings);
  const risk = riskOf(score, base.findings);
  const actionable = base.findings.filter((f) => f.severity !== "info");
  const reasons = actionable.length
    ? actionable.map((f) => f.title)
    : ["No scam pattern found in the QR payload"];

  const f = base.fields;
  const payee = base.kind === "upi" ? f.pn || f.pa || "Unknown payee" : base.kind === "url" ? f.host : "QR content";
  const amount = base.kind === "upi" && f.am ? `₹${Number(f.am).toLocaleString("en-IN")}` : undefined;

  const copy = {
    "High Risk": {
      recommended_action: "Is QR se payment mat karo. Receive karne ke liye kabhi QR scan ya PIN ki zarurat nahi hoti.",
      hindi_summary: "Ye QR scam jaisa lag raha hai. Paise lene ke liye QR scan nahi karna padta.",
    },
    Caution: {
      recommended_action: "Payee ka naam shop board ya person se match karo, phir hi pay karo.",
      hindi_summary: "QR me kuch cheezein suspicious hain. Pay karne se pehle verify karo.",
    },
    Safe: {
      recommended_action: `Payee naam "${payee}" confirm karke hi pay karo.`,
      hindi_summary: "QR normal lag raha hai. Amount aur payee naam check karke pay karo.",
    },
  }[risk];

  const flagIds = base.findings.filter((x) => ["high", "medium"].includes(x.severity)).map((x) => x.id);

  return {
    risk,
    score,
    reasons: reasons.slice(0, 6),
    red_flags: flagIds,
    safe_to_proceed: risk === "Safe",
    suggested_ui:
      risk === "Safe"
        ? { primary_button: "Continue to Pay", secondary_button: "Ask Shield" }
        : risk === "High Risk"
          ? { primary_button: "Block & Ignore", secondary_button: "Report Scam" }
          : { primary_button: "Verify First", secondary_button: "Continue Anyway" },
    ...copy,
    source: "qr-analyzer",
    message: "QR payload analysed on-device",
    detected_language: "en",
    matched_terms: [],
    complaint_alert: {
      found: base.findings.some((x) => x.id === "community_flagged"),
      hits: [],
      message_hi: base.findings.find((x) => x.id === "community_flagged")?.title || "",
      message_en: base.findings.find((x) => x.id === "community_flagged")?.title || "",
    },
    qr: { ...base, raw: payload },
    payment: { payee, amount, collect: base.kind === "upi" && f.action === "collect", entity: f.pa || f.host || "" },
  };
}

export const DEMO_QR_PAYLOADS = [
  { label: "Shop QR (normal)", payload: "upi://pay?pa=sharmasweets@okhdfcbank&pn=Sharma%20Sweets&mc=5411&cu=INR&am=240" },
  { label: "'Receive refund' QR", payload: "upi://pay?pa=refund.claim@ybl&pn=Refund%20Support&am=4999&tn=Cashback%20refund%20receive" },
  { label: "Collect-request QR", payload: "upi://collect?pa=fraud.collect@oksbi&pn=Buyer&am=5000&tn=Receive%20advance" },
  { label: "Phishing link QR", payload: "http://paytm-kyc-verify.xyz/login?update=kyc" },
  { label: "Short link QR", payload: "https://bit.ly/paytm-reward" },
  { label: "Unknown handle QR", payload: "upi://pay?pa=9988776655@zzbank&pn=Amit&am=25000" },
];
