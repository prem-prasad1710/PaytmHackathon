/**
 * Live judge demo — scripted end-to-end scam story that runs fully offline.
 * Each step has narration + UI payloads (message analysis, playbook, decision, guardian).
 */

export const JUDGE_DEMO_META = {
  id: "digital_arrest_kyc_combo",
  title: "Judge demo: digital arrest → fake KYC collect",
  titleHi: "जज डेमो: डिजिटल अरेस्ट → नकली KYC",
  durationHint: "~90 seconds",
  blurb:
    "A caller claims to be cyber-crime police, pushes AnyDesk, then sends a KYC-collect UPI. Shield walks the playbook, scores the payment, and stops the victim.",
};

/** Canned offline decision shaped like FraudEngine output (no API required). */
const SCAM_DECISION = {
  id: "judge_demo_tx",
  timestamp: 1800000000,
  transaction: {
    senderId: "user_demo",
    recipientId: "kyc.verify@ibl",
    amount: 1,
    deviceId: "D_demo",
    ipAddress: "IP_demo",
  },
  riskScore: 96,
  riskLevel: "CRITICAL",
  decision: "BLOCK",
  mlAvailable: false,
  ml: {
    available: false,
    mock: false,
    score: null,
    probability: null,
    modelVersion: null,
    algorithm: null,
    threshold: null,
    topFactors: [],
    protectiveFactors: [],
    scamDna: null,
    latencyMs: null,
    error: "Judge demo offline path — graph + rules only",
  },
  graph: {
    score: 88,
    connectedEntities: 2,
    connectedBlocked: 2,
    connectedVictims: 17,
    distanceToBlocked: 1,
    ringSize: 6,
    reasons: [
      "Connected to 2 blocked KYC-collect entities",
      "17 community complaints on related handles",
    ],
  },
  rules: {
    score: 92,
    triggeredRules: ["NEW_ACCOUNT_RECIPIENT", "HIGH_COMPLAINT_RATE", "LARGE_FIRST_PAYMENT", "DEVICE_SHARING"],
    details: [
      { id: "NEW_ACCOUNT_RECIPIENT", label: "Recipient account is very new", weight: 0.25, detail: "Payee handle first seen in this demo world" },
      { id: "HIGH_COMPLAINT_RATE", label: "Community complaints", weight: 0.5, detail: "kyc.verify@ibl appears in the complaint registry" },
      { id: "LARGE_FIRST_PAYMENT", label: "Unusual first payment pattern", weight: 0.35, detail: "₹1 'verification' collect to a new payee" },
      { id: "DEVICE_SHARING", label: "Shared device ring", weight: 0.35, detail: "Same device cluster linked to prior scam reports" },
    ],
  },
  aggregation: {
    weights: { ml: 0, graph: 0.55, rules: 0.45 },
    weightedScore: 90,
    overridesApplied: [
      { id: "CONFIRMED_NETWORK_EXTREME_VELOCITY", detail: "Confirmed scam-adjacent network + collect-to-verify pattern" },
    ],
    thresholds: { warning: 35, block: 70, critical: 85 },
  },
  facts: {
    recipientAgeDays: 2,
    payments5m: 12,
    payments1h: 40,
    complaints: 17,
    complaintRate: 0.31,
    deviceUsers: 5,
    fundTransferVelocity: 0.9,
  },
  summary: "Payment blocked - risk 96/100 (CRITICAL). Confirmed scam-adjacent network + collect-to-verify pattern",
  explanation: [
    "Confirmed scam-adjacent network + collect-to-verify pattern",
    "Payee handle first seen in this demo world",
    "kyc.verify@ibl appears in the complaint registry",
    "₹1 'verification' collect to a new payee",
    "Connected to 2 blocked KYC-collect entities",
    "ML model unavailable: decision made by the rule and graph engines only",
  ],
  explanationSource: "template",
  latencyMs: 1.2,
};

const MESSAGE =
  "Cyber cell se Inspector Sharma bol raha hoon. Aapka parcel drugs ke saath pakda gaya. Call pe raho, ghar walon ko mat batana. AnyDesk install karo aur KYC verify ke liye kyc.verify@ibl pe ₹1 collect accept karo warna digital arrest.";

export const JUDGE_DEMO_STEPS = [
  {
    id: "arrive",
    title: "1 · Message arrives",
    titleHi: "मैसेज आया",
    narration:
      "Victim is on a call. An SMS/WhatsApp lands: cyber-cell intimidation + AnyDesk + ₹1 KYC collect. This is the opening of a digital-arrest script.",
    narrationHi: "कॉल पर रहते हुए मैसेज आता है — साइबर सेल का डर, AnyDesk, और ₹1 KYC कलेक्ट।",
    kind: "message",
    message: MESSAGE,
    autoMs: 0,
  },
  {
    id: "signals",
    title: "2 · Signals light up",
    titleHi: "सिग्नल्स",
    narration:
      "Offline Shield flags authority fear, secrecy ('mat batana'), screen-share app, OTP/collect language — coercion score spikes.",
    narrationHi: "ऑफलाइन इंजन डर, गोपनीयता, स्क्रीन-शेयर और कलेक्ट संकेतों को पकड़ता है।",
    kind: "signals",
    message: MESSAGE,
    autoMs: 0,
  },
  {
    id: "playbook",
    title: "3 · Playbook stage",
    titleHi: "प्लेबुक स्टेज",
    narration:
      "Matched playbook: Digital arrest / sextortion. Victim is pushed toward screen-share and the pay-to-clear stage.",
    narrationHi: "प्लेबुक: डिजिटल अरेस्ट। स्क्रीन-शेयर और पेमेंट वाले चरण की ओर धकेल रहे हैं।",
    kind: "playbook",
    message: MESSAGE,
    playbookId: "digital_arrest",
    autoMs: 0,
  },
  {
    id: "decision",
    title: "4 · Payment decision",
    titleHi: "पेमेंट निर्णय",
    narration:
      "Victim almost accepts the ₹1 collect to kyc.verify@ibl. Graph + rules score CRITICAL and BLOCK — even with ML offline.",
    narrationHi: "₹1 कलेक्ट पर ग्राफ + रूल्स CRITICAL/BLOCK देते हैं — ML बंद होने पर भी।",
    kind: "decision",
    decision: SCAM_DECISION,
    autoMs: 0,
  },
  {
    id: "guardian",
    title: "5 · Guardian intervention",
    titleHi: "गार्जियन",
    narration:
      "Full-screen Guardian: 'Someone may be coaching you'. Helpline 1930. Block & report — money never leaves.",
    narrationHi: "गार्जियन: कोई कोचिंग कर रहा हो सकता है। 1930। ब्लॉक — पैसे नहीं जाते।",
    kind: "guardian",
    message: MESSAGE,
    autoMs: 0,
  },
  {
    id: "family",
    title: "6 · Family guardian",
    titleHi: "परिवार गार्जियन",
    narration:
      "Before any money moves, the payer asks Mom to approve. Guardian declines on the Family inbox — payment stays locked.",
    narrationHi: "पेमेंट से पहले माँ से अप्रूवल। गार्जियन मना करता है — लॉक रहता है।",
    kind: "family",
    message: MESSAGE,
    autoMs: 0,
  },
  {
    id: "outcome",
    title: "7 · Outcome",
    titleHi: "नतीजा",
    narration:
      "Outcome: BLOCKED. Playbook documented, community complaint ready, victim told to hang up and leave AnyDesk. Advisory only — no real payment.",
    narrationHi: "नतीजा: ब्लॉक। कॉल काटो, AnyDesk बंद करो, शिकायत दर्ज करो।",
    kind: "outcome",
    decision: SCAM_DECISION,
    autoMs: 0,
  },
];

export function getJudgeDemoSteps() {
  return JUDGE_DEMO_STEPS.map((s) => ({ ...s }));
}
