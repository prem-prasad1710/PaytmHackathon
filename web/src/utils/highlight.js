const FALLBACK_LEXICON = [
  "upi pin", "otp", "cvv", "pin", "kyc", "urgent", "immediately", "turant", "abhi", "arrest", "lottery",
  "prize", "winner", "refund", "cashback", "scan", "qr", "anydesk", "teamviewer", "fee", "block", "blocked",
  "suspended", "verify", "claim", "reward", "emergency", "police", "fine", "penalty", "disconnected",
  "collect", "approve", "advance", "registration",
];

const URL_RE = "(?:https?:\\/\\/|www\\.)[^\\s]+|(?:bit\\.ly|tinyurl\\.com|cutt\\.ly|rb\\.gy|wa\\.me)\\/[^\\s]+";
const UPI_RE = "[\\w.-]+@[a-z]{2,}";
const PHONE_RE = "(?:\\+91[-\\s]?)?[6-9]\\d{9}";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Split text into segments; hit segments carry a 0..1 intensity so the UI
 * can shade stronger ML signals darker.
 */
export function highlightSegments(text, mlTokens = []) {
  if (!text) return [];
  const weights = new Map();
  const maxW = Math.max(0.0001, ...mlTokens.map((t) => t.weight));
  for (const t of mlTokens) weights.set(t.token.toLowerCase(), Math.min(1, t.weight / maxW));
  for (const w of FALLBACK_LEXICON) if (!weights.has(w)) weights.set(w, 0.45);

  const words = [...weights.keys()].sort((a, b) => b.length - a.length).map(esc);
  const pattern = new RegExp(
    `(${URL_RE})|(${UPI_RE})|(${PHONE_RE})|(?<![\\w])(${words.join("|")})(?![\\w])`,
    "gi"
  );

  const out = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
    const kind = m[1] ? "link" : m[2] ? "upi" : m[3] ? "phone" : "word";
    const intensity = kind === "word" ? weights.get(m[0].toLowerCase()) ?? 0.45 : 0.9;
    out.push({ text: m[0], hit: true, kind, intensity });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}
