/**
 * Scammer's playbook — known Indian UPI scam scripts as staged timelines.
 * Pure functions; works fully offline. Consumed by offlineEngine, server explainer, and web UI.
 */

export const PLAYBOOKS = [
  {
    id: "fake_kyc",
    name: "Fake KYC / account freeze",
    nameHi: "नकली KYC / अकाउंट ब्लॉक",
    family: "phishing_kyc",
    stages: [
      { id: "bait", label: "Bait SMS", labelHi: "फिशिंग SMS", nextAsk: "Click a short link or call a 'helpline' number" },
      { id: "fear", label: "Fear / urgency", labelHi: "डर + जल्दी", nextAsk: "Claim KYC expired / power will disconnect / account will freeze today" },
      { id: "authority", label: "Fake authority", labelHi: "नकली अधिकारी", nextAsk: "Impersonate bank / electricity board / Paytm support" },
      { id: "collect", label: "Collect / ₹1 verify", labelHi: "कलेक्ट / ₹1 वेरिफाई", nextAsk: "Ask for a tiny UPI collect or prepaid 'verification' payment" },
      { id: "cashout", label: "PIN / OTP harvest", labelHi: "PIN/OTP चोरी", nextAsk: "Ask for UPI PIN, OTP or remote-access app" },
    ],
    keywords: ["kyc", "केवाईसी", "account freeze", "verify account", "bijli kat", "disconnection", "kat jayegi", "power cut", "expired kyc", "kyc pending"],
  },
  {
    id: "wrong_transfer",
    name: "Wrong UPI transfer — please refund",
    nameHi: "गलत ट्रांसफर — रिफंड करो",
    family: "refund",
    stages: [
      { id: "claim", label: "Wrong credit claim", labelHi: "गलत क्रेडिट", nextAsk: "Message: 'I sent money by mistake, please refund'" },
      { id: "pressure", label: "Polite pressure", labelHi: "दबाव", nextAsk: "Share fake screenshot of payment success" },
      { id: "new_upi", label: "Different refund UPI", labelHi: "अलग UPI", nextAsk: "Ask refund to a different handle than the one that 'paid'" },
      { id: "collect_trap", label: "Collect disguised as receive", labelHi: "कलेक्ट ट्रैप", nextAsk: "Send a collect request labelled as 'receive money'" },
      { id: "mule", label: "Money moves out", labelHi: "पैसे आगे", nextAsk: "Forward funds to mule accounts within minutes" },
    ],
    keywords: ["wrong transfer", "galat", "mistake", "refund", "by mistake", "wapas", "return money", "sent to wrong"],
  },
  {
    id: "collect_disguise",
    name: "Collect request as 'receive'",
    nameHi: "कलेक्ट को रिसीव बताना",
    family: "collect",
    stages: [
      { id: "hook", label: "Offer / job / cashback", labelHi: "ऑफर", nextAsk: "Promise cashback, job task reward or prize" },
      { id: "qr", label: "Share QR / link", labelHi: "QR भेजना", nextAsk: "Send QR or upi://pay?mode=collect style link" },
      { id: "rename", label: "Relabel as receive", labelHi: "रिसीव कहना", nextAsk: "Tell victim 'ye receive karne wala QR hai'" },
      { id: "pin", label: "Ask PIN to 'receive'", labelHi: "PIN माँगना", nextAsk: "Say PIN is needed to get money into your account" },
      { id: "drain", label: "Account drained", labelHi: "पैसे निकलना", nextAsk: "Collect pulls money out once PIN is entered" },
    ],
    keywords: ["collect", "receive money", "paise receive", "qr scan", "mode=collect", "request money", "paise aayenge"],
  },
  {
    id: "job_task",
    name: "Job / task scam",
    nameHi: "नौकरी / टास्क स्कैम",
    family: "job",
    stages: [
      { id: "recruit", label: "Easy job offer", labelHi: "आसानी से जॉब", nextAsk: "WhatsApp: work from home, like/share tasks" },
      { id: "small_win", label: "Small payout", labelHi: "छोटा पेमेंट", nextAsk: "Pay ₹50–200 for first 'tasks' to build trust" },
      { id: "upgrade", label: "Bigger task", labelHi: "बड़ा टास्क", nextAsk: "Ask victim to 'recharge' or pay to unlock higher tier" },
      { id: "deposit", label: "Security deposit", labelHi: "सिक्योरिटी डिपॉजिट", nextAsk: "Demand large UPI deposit to continue earning" },
      { id: "ghost", label: "Block & disappear", labelHi: "ब्लॉक", nextAsk: "Block the victim after the deposit" },
    ],
    keywords: ["work from home", "part time", "task", "like share", "earning", "salary", "joining fee", "security deposit", "job offer"],
  },
  {
    id: "digital_arrest",
    name: "Digital arrest / sextortion",
    nameHi: "डिजिटल अरेस्ट / सेक्सटॉर्शन",
    family: "extortion",
    stages: [
      { id: "shock", label: "Shock call", labelHi: "झटका कॉल", nextAsk: "Caller claims to be police / CBI / customs" },
      { id: "isolate", label: "Isolate victim", labelHi: "अकेला करना", nextAsk: "'Stay on the call, don't tell family'" },
      { id: "screen", label: "Screen share", labelHi: "स्क्रीन शेयर", nextAsk: "Install AnyDesk / TeamViewer / QuickSupport" },
      { id: "threat", label: "Arrest / leak threat", labelHi: "गिरफ्तारी धमकी", nextAsk: "Threaten digital arrest, parcel drugs, or intimate video leak" },
      { id: "pay", label: "Pay to 'clear' case", labelHi: "केस क्लियर", nextAsk: "Demand UPI / crypto / gift cards to close the case" },
    ],
    keywords: ["digital arrest", "cbi", "cyber cell", "police", "customs", "parcel", "anydesk", "teamviewer", "sextortion", "video leak", "warrant"],
  },
  {
    id: "marketplace",
    name: "OLX / marketplace buyer QR",
    nameHi: "OLX / मार्केटप्लेस QR",
    family: "marketplace",
    stages: [
      { id: "interest", label: "Buyer interest", labelHi: "खरीदार", nextAsk: "Message about listing on OLX / Quikr / Facebook" },
      { id: "escrow", label: "Fake escrow story", labelHi: "नकली एस्क्रो", nextAsk: "Claim payment is held; need QR to 'release'" },
      { id: "qr_swap", label: "Malicious QR", labelHi: "नकली QR", nextAsk: "Send QR that is actually a collect / pay-to-scammer" },
      { id: "courier", label: "Courier advance", labelHi: "कूरियर एडवांस", nextAsk: "Ask shipping / token fee before pickup" },
      { id: "vanish", label: "Ghost after pay", labelHi: "गायब", nextAsk: "Stop responding after money moves" },
    ],
    keywords: ["olx", "quikr", "marketplace", "buyer", "escrow", "token amount", "courier", "shipping fee", "release payment"],
  },
];

function norm(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Score how well text matches a playbook's keywords (simple substring hits). */
function keywordScore(text, keywords) {
  const t = norm(text);
  if (!t) return { score: 0, hits: [] };
  const hits = [];
  for (const kw of keywords) {
    if (t.includes(String(kw).toLowerCase())) hits.push(kw);
  }
  return { score: hits.length, hits };
}

/** Infer stage index from cues in the text. */
function inferStageIndex(playbook, text, extras = {}) {
  const t = norm(text);
  const stages = playbook.stages;
  let idx = 0;

  const stageHints = {
    fake_kyc: [
      [/kyc|केवाईसी|freeze|block|expired|bijli|electric/i, 1],
      [/bank|paytm support|customer care|helpline/i, 2],
      [/collect|₹\s*1|rs\.?\s*1|verify.*pay|upi/i, 3],
      [/pin|otp|anydesk|teamviewer|password/i, 4],
    ],
    wrong_transfer: [
      [/mistake|galat|wrong|refund|wapas/i, 0],
      [/screenshot|slip|paid you/i, 1],
      [/different|another upi|is upi pe/i, 2],
      [/collect|request money|receive/i, 3],
    ],
    collect_disguise: [
      [/cashback|prize|job|reward/i, 0],
      [/qr|scan|upi:\/\//i, 1],
      [/receive|paise aayenge|milega/i, 2],
      [/pin|otp/i, 3],
    ],
    job_task: [
      [/work from home|part time|task|job offer/i, 0],
      [/paid|received|earning/i, 1],
      [/upgrade|next level|recharge/i, 2],
      [/deposit|joining fee|security/i, 3],
    ],
    digital_arrest: [
      [/police|cbi|cyber|customs|warrant/i, 0],
      [/don't tell|mat batana|stay on (the )?call|call pe raho/i, 1],
      [/anydesk|teamviewer|quicksupport|screen ?share|ultraviewer/i, 2],
      [/arrest|sextortion|video|nude|parcel/i, 3],
      [/pay|upi|bitcoin|gift card|fine/i, 4],
    ],
    marketplace: [
      [/olx|quikr|buyer|interested/i, 0],
      [/escrow|hold|release/i, 1],
      [/qr|scan/i, 2],
      [/courier|shipping|token/i, 3],
    ],
  };

  const hints = stageHints[playbook.id] || [];
  for (const [re, stageIdx] of hints) {
    if (re.test(t)) idx = Math.max(idx, stageIdx);
  }
  if (extras.collect) idx = Math.max(idx, Math.min(stages.length - 1, 3));
  if (extras.coercionRemote) idx = Math.max(idx, Math.min(stages.length - 1, 2));
  return Math.min(idx, stages.length - 1);
}

/**
 * Detect the most likely scam playbook and current stage from message/txn context.
 * @returns {null|{playbookId,name,nameHi,family,stageIndex,stageCount,stage,nextAsk,confidence,hits,stages}}
 */
export function detectPlaybook(text = "", extras = {}) {
  const t = norm(text);
  if (!t && !extras.collect) return null;

  let best = null;
  for (const pb of PLAYBOOKS) {
    const { score, hits } = keywordScore(t, pb.keywords);
    let bonus = 0;
    if (extras.collect && (pb.id === "collect_disguise" || pb.id === "fake_kyc" || pb.id === "wrong_transfer")) bonus += 1.5;
    if (extras.coercionRemote && pb.id === "digital_arrest") bonus += 2;
    if (extras.coercionAuthority && (pb.id === "digital_arrest" || pb.id === "fake_kyc")) bonus += 1;
    const total = score + bonus;
    if (!best || total > best.total) {
      best = { pb, total, hits };
    }
  }

  // Official billers / benign bill language should not become a KYC playbook match
  if (/official biller|consumer no|due date|state electricity board/i.test(t)) {
    if (best && best.pb.id === "fake_kyc" && best.total < 3) best = null;
  }

  if (!best || best.total < 1) return null;

  const stageIndex = inferStageIndex(best.pb, text, extras);
  const stage = best.pb.stages[stageIndex];
  const confidence = Math.min(0.95, 0.35 + best.total * 0.12);

  return {
    playbookId: best.pb.id,
    name: best.pb.name,
    nameHi: best.pb.nameHi,
    family: best.pb.family,
    stageIndex,
    stageCount: best.pb.stages.length,
    stage: { id: stage.id, label: stage.label, labelHi: stage.labelHi },
    nextAsk: stage.nextAsk,
    confidence: Number(confidence.toFixed(2)),
    hits: best.hits.slice(0, 6),
    stages: best.pb.stages.map((s, i) => ({
      id: s.id,
      label: s.label,
      labelHi: s.labelHi,
      nextAsk: s.nextAsk,
      state: i < stageIndex ? "done" : i === stageIndex ? "current" : "upcoming",
    })),
    youAreHere: `You are at stage ${stageIndex + 1} of ${best.pb.stages.length} (${stage.label}). Next the scammer will likely: ${stage.nextAsk}.`,
    youAreHereHi: `आप स्टेज ${stageIndex + 1}/${best.pb.stages.length} पर हैं (${stage.labelHi}). अगला कदम: ${stage.nextAsk}.`,
  };
}

export function getPlaybookById(id) {
  return PLAYBOOKS.find((p) => p.id === id) || null;
}
