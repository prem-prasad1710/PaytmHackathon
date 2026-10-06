const MAX_TEXT_LEN = 2000;
const MAX_URLS = 10;

const URL_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "rb.gy", "cutt.ly", "t.co", "wa.me", "goo.gl", "ow.ly",
  "is.gd", "buff.ly", "shorturl.at", "rebrand.ly", "tiny.cc", "soo.gd", "s.id",
]);

const RISKY_TLDS = new Set([
  "xyz", "top", "click", "icu", "live", "support", "site", "online", "vip", "buzz",
  "rest", "cfd", "sbs", "cam", "work", "monster", "quest", "bond", "loan", "bar",
]);

const SCAM_KEYWORDS = [
  "kyc", "verify", "update", "reward", "refund", "claim", "otp", "login", "secure",
  "cashback", "lottery", "prize", "unlock", "suspend", "blocked", "urgent",
];

const DANGEROUS_SCHEMES = new Set(["javascript", "data", "vbscript"]);

const SUSPICIOUS_SCHEMES = new Set(["tel", "intent"]);

const TWO_PART_SUFFIXES = new Set([
  "co.in", "gov.in", "org.in", "net.in", "ac.in", "edu.in", "nic.in", "res.in",
  "gen.in", "firm.in", "ind.in", "co.uk", "com.au",
]);

const BRANDS = [
  { id: "paytm", names: ["paytm", "paytmbank"], official: ["paytm.com", "paytmbank.com", "paytm.in"] },
  { id: "phonepe", names: ["phonepe"], official: ["phonepe.com"] },
  { id: "gpay", names: ["gpay", "googlepay", "googlepayindia"], official: ["pay.google.com", "google.com", "google.co.in"] },
  { id: "sbi", names: ["sbi", "onlinesbi", "sbionline"], official: ["sbi.co.in", "onlinesbi.sbi", "sbicard.com"] },
  { id: "hdfc", names: ["hdfc", "hdfcbank"], official: ["hdfcbank.com", "hdfcbank.net"] },
  { id: "icici", names: ["icici", "icicibank"], official: ["icicibank.com", "icicidirect.com"] },
  { id: "axis", names: ["axis", "axisbank"], official: ["axisbank.com", "axisbank.co.in"] },
  { id: "kotak", names: ["kotak", "kotakbank"], official: ["kotak.com", "kotak811.com"] },
  { id: "amazon", names: ["amazon"], official: ["amazon.in", "amazon.com", "amazonpay.in"] },
  { id: "flipkart", names: ["flipkart"], official: ["flipkart.com"] },
  { id: "npci", names: ["npci", "bhim", "upi"], official: ["npci.org.in", "bhimupi.org.in"] },
  { id: "irctc", names: ["irctc"], official: ["irctc.co.in", "irctc.com"] },
  { id: "jio", names: ["jio", "jiomart"], official: ["jio.com", "jiomart.com"] },
  { id: "airtel", names: ["airtel"], official: ["airtel.in", "airtel.com"] },
  { id: "incometax", names: ["incometax", "itdept", "incometaxindia"], official: ["incometax.gov.in", "incometaxindia.gov.in", "incometaxindiaefiling.gov.in"] },
  { id: "uidai", names: ["uidai", "aadhaar", "aadhar"], official: ["uidai.gov.in", "myaadhaar.uidai.gov.in"] },
  { id: "digilocker", names: ["digilocker"], official: ["digilocker.gov.in", "digilocker.com"] },
];

const LEET_MAP = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s",
  "!": "i", "|": "l",
};

const URL_RE = /(?:https?:\/\/|upi:\/\/|tel:|intent:|javascript:|data:)[^\s<>"')\]]+/gi;
const BARE_DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]+)\b(?:\/[^\s<>"')\]]*)?/gi;

function urlDedupeKey(raw) {
  try {
    const normalized = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(normalized);
    return `${u.protocol}//${u.host}${u.pathname}${u.search}`;
  } catch {
    return raw.toLowerCase();
  }
}

export function extractUrls(text) {
  if (typeof text !== "string") return [];
  const seen = new Set();
  const out = [];

  const add = (raw) => {
    const cleaned = raw.replace(/[.,;:!?)]+$/, "");
    if (!cleaned) return;
    const key = urlDedupeKey(cleaned);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };

  URL_RE.lastIndex = 0;
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    add(m[0]);
    if (out.length >= MAX_URLS) return out;
  }

  BARE_DOMAIN_RE.lastIndex = 0;
  while ((m = BARE_DOMAIN_RE.exec(text)) !== null) {
    add(m[0]);
    if (out.length >= MAX_URLS) return out;
  }

  return out.slice(0, MAX_URLS);
}

export function analyzeUrlsFromText(text) {
  return extractUrls(text).map((u) => analyzeUrl(u));
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function normalizeBrandToken(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, (ch) => LEET_MAP[ch] ?? "")
    .replace(/[оο]/g, "o")
    .replace(/[а]/g, "a")
    .replace(/[е]/g, "e")
    .replace(/[р]/g, "p")
    .replace(/[у]/g, "y")
    .replace(/[т]/g, "t")
    .replace(/[м]/g, "m");
}

function getRegistrableDomain(host) {
  if (!host) return "";
  const parts = host.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (TWO_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return `${parts[parts.length - 3]}.${lastTwo}`;
  }
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

function splitHostAnatomy(host) {
  if (!host) return { subdomain: "", registrableDomain: "", tld: "", highlight: "registrableDomain" };
  const registrableDomain = getRegistrableDomain(host);
  const rdParts = registrableDomain.split(".");
  const tld = rdParts.length >= 2 ? rdParts.slice(-2).join(".") : rdParts[rdParts.length - 1] || "";
  const labelTld = rdParts[rdParts.length - 1] || "";
  const subdomain = host.toLowerCase().endsWith(registrableDomain)
    ? host.toLowerCase().slice(0, host.length - registrableDomain.length).replace(/\.$/, "")
    : "";
  return { subdomain, registrableDomain, tld: labelTld, fullTld: tld };
}

function isOfficialDomain(registrableDomain) {
  const rd = registrableDomain.toLowerCase();
  for (const brand of BRANDS) {
    if (brand.official.some((d) => rd === d || rd.endsWith(`.${d}`))) {
      return { official: true, brand: brand.id };
    }
  }
  return { official: false, brand: null };
}

function parseTarget(input) {
  const raw = String(input || "").trim();
  if (!raw) return { error: "empty" };

  let normalized = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    normalized = `https://${raw}`;
  }

  try {
    const url = new URL(normalized);
    return { url, normalized: url.href, input: raw };
  } catch {
    if (/^upi:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        return { url, normalized: url.href, input: raw };
      } catch {
        return { error: "invalid" };
      }
    }
    return { error: "invalid" };
  }
}

function combineWeights(weights) {
  if (!weights.length) return 0;
  let product = 1;
  for (const w of weights) product *= 1 - Math.min(1, Math.max(0, w));
  return Math.round(100 * (1 - product));
}

function verdictFromScore(score) {
  if (score < 30) return "SAFE";
  if (score < 65) return "SUSPICIOUS";
  return "DANGEROUS";
}

function pushSignal(signals, id, label, weight, detail) {
  signals.push({ id, label, weight, detail });
}

function primaryDomainLabel(host, registrableDomain) {
  const label = registrableDomain.split(".")[0] || host.split(".")[0] || "";
  return label;
}

function detectBrandLookalike(text, registrableDomain, officialInfo) {
  if (officialInfo.official) return null;
  const token = normalizeBrandToken(text);
  if (!token || token.length < 3) return null;

  let best = null;
  for (const brand of BRANDS) {
    for (const name of brand.names) {
      const norm = normalizeBrandToken(name);
      if (!norm) continue;
      if (token === norm) {
        best = { brand: brand.id, kind: "exact", distance: 0, matched: name };
        continue;
      }
      if (token.includes(norm) && token.length <= norm.length + 4) {
        const candidate = { brand: brand.id, kind: "contains", distance: 0, matched: name };
        if (!best || norm.length > best.matched.length) best = candidate;
        continue;
      }
      const dist = levenshtein(token, norm);
      const maxLen = Math.max(token.length, norm.length);
      const threshold = maxLen <= 5 ? 1 : maxLen <= 8 ? 2 : 3;
      if (dist > 0 && dist <= threshold) {
        const candidate = { brand: brand.id, kind: "typosquat", distance: dist, matched: name };
        if (!best || dist < best.distance) best = candidate;
      }
    }
  }
  return best;
}

function detectBrandInHostPath(host, path, registrableDomain, officialInfo) {
  if (officialInfo.official) return null;
  const hay = `${host} ${path}`.toLowerCase();
  for (const brand of BRANDS) {
    for (const name of brand.names) {
      if (!hay.includes(name)) continue;
      const onOfficial = brand.official.some((d) => registrableDomain === d || registrableDomain.endsWith(`.${d}`));
      if (!onOfficial) {
        return { brand: brand.id, kind: "embedded", matched: name };
      }
    }
  }
  return null;
}

function parseUpiLink(url) {
  const action = url.hostname || url.pathname.replace(/^\//, "");
  const params = url.searchParams;
  return {
    action,
    pa: params.get("pa") || "",
    pn: params.get("pn") || "",
    am: params.get("am") || "",
    tn: params.get("tn") || "",
    mc: params.get("mc") || "",
  };
}

function buildAdvice(verdict, signals, brandMatch, officialInfo) {
  const advice = [];
  if (verdict === "SAFE") {
    advice.push("This link looks structurally normal, but always verify the sender before paying.");
  } else if (verdict === "SUSPICIOUS") {
    advice.push("Do not tap the link. Open the official app or type the address yourself.");
    advice.push("Call the organisation on a number from their official website, not from the message.");
  } else {
    advice.push("Do not open this link or enter any OTP, PIN, or UPI details.");
    advice.push("Delete the message and report it as phishing if it claimed to be your bank or Paytm.");
  }
  if (signals.some((s) => s.id === "url_shortener")) {
    advice.push("Short links hide the real destination — never use them for payments.");
  }
  if (signals.some((s) => s.id === "upi_collect")) {
    advice.push("A collect link asks you to approve money leaving your account — treat it as high risk.");
  }
  if (brandMatch && !officialInfo.official) {
    advice.push(`This may be impersonating ${brandMatch.brand}. Use only the official domain listed below.`);
  }
  return advice.slice(0, 5);
}

export function analyzeUrl(input) {
  const parsed = parseTarget(input);
  if (parsed.error) {
    return {
      input: String(input || ""),
      normalized: "",
      host: "",
      registrableDomain: "",
      verdict: "DANGEROUS",
      score: 85,
      signals: [{ id: "invalid_url", label: "Invalid URL", weight: 0.85, detail: "Could not parse this as a valid link." }],
      brandMatch: null,
      advice: ["Do not trust unparseable links sent in SMS or chat."],
      anatomy: null,
    };
  }

  const { url, normalized, input: rawInput } = parsed;
  const scheme = url.protocol.replace(/:$/, "").toLowerCase();
  const host = url.hostname.toLowerCase();
  const registrableDomain = getRegistrableDomain(host);
  const path = `${url.pathname}${url.search}`.toLowerCase();
  const fullText = `${host}${path}`;
  const officialInfo = isOfficialDomain(registrableDomain);
  const signals = [];

  if (DANGEROUS_SCHEMES.has(scheme)) {
    pushSignal(signals, "dangerous_scheme", "Dangerous link type", 0.95, `Uses the ${scheme}: scheme which can run code or embed content.`);
  }
  if (SUSPICIOUS_SCHEMES.has(scheme)) {
    pushSignal(signals, "suspicious_scheme", "Unusual link type", 0.55, `Uses ${scheme}: which is uncommon for legitimate payment pages.`);
  }

  if (scheme === "upi") {
    const upi = parseUpiLink(url);
    if (upi.action === "collect") {
      pushSignal(signals, "upi_collect", "UPI collect request", 0.75, "This is a collect (money-request) link, not a simple pay link.");
    } else if (upi.action === "pay") {
      pushSignal(signals, "upi_pay", "UPI payment link", 0.2, "Standard UPI pay link — verify the payee handle before approving.");
    }
    if (/receive|collect|request/i.test(upi.tn) || /receive|collect/i.test(upi.pn)) {
      pushSignal(signals, "upi_receive_phrase", "Receive-money wording", 0.5, "Note or name suggests you are being asked to receive or approve money.");
    }
    if (!upi.pa) {
      pushSignal(signals, "upi_missing_pa", "Missing payee handle", 0.45, "No UPI ID (pa=) found in the link.");
    } else if (!/@/.test(upi.pa) && !/^\d{10}$/.test(upi.pa)) {
      pushSignal(signals, "upi_unknown_handle", "Unusual payee handle", 0.35, `Payee handle "${upi.pa}" does not look like a typical UPI ID.`);
    }
  }

  if (host && /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    pushSignal(signals, "ip_literal", "IP address host", 0.7, "Real banks and shops use domain names, not raw IP addresses.");
  }

  if (rawInput.includes("xn--") || host.includes("xn--") || /[^\x00-\x7f]/.test(host) || /[^\x00-\x7f]/.test(rawInput)) {
    pushSignal(signals, "punycode_idn", "Internationalized domain", 0.65, "Domain uses punycode or non-Latin letters that can mimic trusted brands.");
  }

  if (url.username || url.password || rawInput.includes("@")) {
    const atIdx = rawInput.indexOf("@");
    const schemeEnd = rawInput.indexOf("://");
    if (atIdx > -1 && (schemeEnd === -1 || atIdx > schemeEnd + 3)) {
      pushSignal(signals, "at_userinfo", "@ trick in URL", 0.6, "Text before @ is ignored by browsers — the real site is after @.");
    }
  }

  const hostParts = host.split(".").filter(Boolean);
  const subdomainCount = Math.max(0, hostParts.length - registrableDomain.split(".").length);
  if (subdomainCount >= 3) {
    pushSignal(signals, "excessive_subdomains", "Many subdomains", 0.45, `${subdomainCount} nested subdomains — common in phishing URLs.`);
  }

  const hyphenCount = (host + path).split("-").length - 1;
  if (hyphenCount >= 3) {
    pushSignal(signals, "excessive_hyphens", "Many hyphens", 0.35, "Several hyphens in the address can indicate a fake site name.");
  }

  const digitCount = (host + path).replace(/\D/g, "").length;
  if (digitCount >= 6) {
    pushSignal(signals, "excessive_digits", "Many digits", 0.3, "Unusually high number of digits in the URL.");
  }

  if (fullText.length > 120) {
    pushSignal(signals, "excessive_length", "Very long URL", 0.25, "Extremely long links are sometimes used to hide the real domain.");
  }

  if (URL_SHORTENERS.has(host) || URL_SHORTENERS.has(registrableDomain)) {
    pushSignal(signals, "url_shortener", "URL shortener", 0.5, `${host} is a link shortener — the true destination is hidden.`);
  }

  const tld = hostParts[hostParts.length - 1] || "";
  if (RISKY_TLDS.has(tld)) {
    pushSignal(signals, "risky_tld", "Risky domain ending", 0.4, `.${tld} is often used for short-lived scam sites.`);
  }

  if (scheme === "http" && !officialInfo.official) {
    pushSignal(signals, "non_https", "Not HTTPS", 0.2, "Login or payment pages should use HTTPS encryption.");
  }

  const scamHits = SCAM_KEYWORDS.filter((kw) => fullText.includes(kw));
  if (scamHits.length) {
    const w = Math.min(0.65, 0.25 + scamHits.length * 0.08);
    pushSignal(signals, "scam_keywords", "Pressure / scam words", w, `Found words often used in fraud: ${scamHits.slice(0, 5).join(", ")}.`);
  }

  const domainLabel = primaryDomainLabel(host, registrableDomain);
  let brandMatch = detectBrandLookalike(domainLabel, registrableDomain, officialInfo);
  if (!brandMatch && subdomainCount > 0) {
    const subLabels = hostParts.slice(0, hostParts.length - registrableDomain.split(".").length);
    for (const sub of subLabels) {
      const hit = detectBrandLookalike(sub, registrableDomain, officialInfo);
      if (hit) {
        brandMatch = { ...hit, kind: "subdomain_typosquat" };
        break;
      }
    }
  }

  const embedded = detectBrandInHostPath(host, path, registrableDomain, officialInfo);
  if (embedded) {
    brandMatch = { brand: embedded.brand, kind: embedded.kind };
    pushSignal(
      signals,
      "brand_embedded",
      "Brand name on wrong site",
      0.75,
      `"${embedded.matched}" appears on ${registrableDomain}, which is not an official ${embedded.brand} domain.`
    );
  } else if (brandMatch && !officialInfo.official) {
    const w = brandMatch.kind === "typosquat" ? 0.7 : brandMatch.kind === "contains" ? 0.65 : 0.8;
    pushSignal(
      signals,
      "brand_lookalike",
      "Brand look-alike domain",
      w,
      `Domain resembles ${brandMatch.brand} (${brandMatch.kind.replace(/_/g, " ")}).`
    );
  }

  let finalBrandMatch = brandMatch;
  const finalSignals = officialInfo.official
    ? signals.filter((s) => !["brand_lookalike", "brand_embedded"].includes(s.id))
    : signals;
  if (officialInfo.official) finalBrandMatch = null;

  const score = combineWeights(finalSignals.map((s) => s.weight));
  const verdict = verdictFromScore(score);
  const anatomy = splitHostAnatomy(host);
  anatomy.highlight = finalBrandMatch ? "registrableDomain" : embedded ? "subdomain" : "registrableDomain";
  anatomy.imitatedBrand = finalBrandMatch?.brand || embedded?.brand || null;

  return {
    input: rawInput,
    normalized,
    host,
    registrableDomain,
    verdict,
    score,
    signals: finalSignals,
    brandMatch: finalBrandMatch ? { brand: finalBrandMatch.brand, kind: finalBrandMatch.kind } : null,
    advice: buildAdvice(verdict, finalSignals, finalBrandMatch, officialInfo),
    anatomy,
    officialDomain: officialInfo.official
      ? registrableDomain
      : (finalBrandMatch || embedded
        ? BRANDS.find((b) => b.id === (finalBrandMatch?.brand || embedded?.brand))?.official[0]
        : null),
  };
}

export function analyzeLinkRequest(body) {
  if (!body || (body.url === undefined && body.text === undefined)) {
    return { error: "Provide url or text", status: 400 };
  }
  if (body.url !== undefined) {
    if (typeof body.url !== "string") return { error: "url must be a string", status: 400 };
    if (!body.url.trim()) return { error: "url cannot be empty", status: 400 };
    if (body.url.length > MAX_TEXT_LEN) return { error: "url too long", status: 400 };
    return { results: [analyzeUrl(body.url)] };
  }
  if (typeof body.text !== "string") return { error: "text must be a string", status: 400 };
  if (!body.text.trim()) return { error: "text cannot be empty", status: 400 };
  if (body.text.length > MAX_TEXT_LEN) return { error: "text too long", status: 400 };
  const urls = extractUrls(body.text);
  if (!urls.length) return { error: "no URLs found in text", status: 400 };
  return { results: urls.map((u) => analyzeUrl(u)) };
}

export { MAX_TEXT_LEN, MAX_URLS, BRANDS };
