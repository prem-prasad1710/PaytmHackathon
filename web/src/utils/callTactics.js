const TACTICS = {
  AUTHORITY_CLAIM: {
    id: "AUTHORITY_CLAIM",
    label: "Authority claim",
    weight: 0.35,
    why: "Scammers pretend to be RBI, police, CBI, or bank officials to scare you into obeying.",
    patterns: [
      /\b(?:bank\s+manager|branch\s+manager|rbi|reserve\s+bank|cbi|police|cyber\s*cell|customs|trai|income\s*tax|ed\s+officer|enforcement\s+directorate)\b/i,
      /(?:बैंक\s*मैनेजर|आरबीआई|सीबीआई|पुलिस|साइबर\s*सेल|कस्टम|ट्राई)/,
      /\b(?:bank\s+se|police\s+se|cbi\s+se|rbi\s+se)\b/i,
    ],
  },
  URGENCY: {
    id: "URGENCY",
    label: "Urgency pressure",
    weight: 0.28,
    why: "Real banks give you time. Scammers rush you so you cannot think or verify.",
    patterns: [
      /\b(?:urgent(?:ly)?|immediately|right\s+now|today\s+only|within\s+\d+\s*(?:hour|minute|min)|act\s+fast|hurry|last\s+chance|deadline)\b/i,
      /\b(?:turant|abhi\s+hi|aaj\s+hi|jaldi\s+karo|time\s+nahi|last\s+warning)\b/i,
      /(?:तुरंत|अभी\s+ही|आज\s+ही|जल्दी)/,
    ],
  },
  SECRECY: {
    id: "SECRECY",
    label: "Secrecy demand",
    weight: 0.42,
    why: "Legitimate institutions never ask you to hide a call from family or police.",
    patterns: [
      /\b(?:don'?t\s+tell\s+(?:anyone|anybody|your\s+family|family|parents)|keep\s+(?:it\s+)?secret|between\s+us|no\s+one\s+should\s+know|stay\s+on\s+the\s+line\s+alone)\b/i,
      /\b(?:kisi\s+ko\s+mat\s+batana|kisi\s+se\s+mat\s+kehna|secret\s+rakh|akela\s+reh|family\s+ko\s+mat\s+batana)\b/i,
      /(?:किसी\s+को\s+मत\s+बताना|रहस्य|गुप्त)/,
    ],
  },
  OTP_PIN_REQUEST: {
    id: "OTP_PIN_REQUEST",
    label: "OTP / PIN request",
    weight: 0.72,
    why: "Banks and government agencies never ask for OTP, PIN, or passwords on a call.",
    patterns: [
      /\b(?:share|send|tell|give|read|dictate|forward)\s+(?:me\s+)?(?:the\s+)?(?:otp|one[\s-]?time\s+password|pin|password|mpin)\b/i,
      /\b(?:otp|pin)\s+(?:bhej|batao|share|dena|dijiye|bolo)\b/i,
      /(?:ओटीपी|ओ\.?टी\.?पी|पिन)\s*(?:भेज|बताओ|दो|शेयर)/,
      /\b(?:otp|pin)\s+(?:aa\s+gaya|aaya|received)\b/i,
    ],
    awarenessGuard: true,
  },
  REMOTE_ACCESS_APP: {
    id: "REMOTE_ACCESS_APP",
    label: "Remote access app",
    weight: 0.68,
    why: "AnyDesk, TeamViewer, and similar apps let scammers control your phone or computer.",
    patterns: [
      /\b(?:anydesk|teamviewer|quick\s*support|quicksupport|rustdesk|ultraviewer|screen\s+share\s+app)\b/i,
      /\b(?:remote\s+access|screen\s+sharing\s+app|install\s+anydesk)\b/i,
    ],
  },
  SAFE_ACCOUNT_TRANSFER: {
    id: "SAFE_ACCOUNT_TRANSFER",
    label: "Safe account transfer",
    weight: 0.75,
    why: "There is no 'safe account' — moving money to a new account is how victims lose savings.",
    patterns: [
      /\b(?:safe\s+account|escrow\s+account|verification\s+account|nodal\s+account|rbi\s+account|government\s+account)\b/i,
      /\b(?:transfer\s+(?:all\s+)?(?:money|funds|balance)\s+to|move\s+your\s+money)\b/i,
      /\b(?:surakshit\s+account|safe\s+account\s+mein|paise\s+transfer\s+karo)\b/i,
      /(?:सुरक्षित\s+खाता|पैसे\s+ट्रांसफर)/,
    ],
  },
  FEE_OR_DEPOSIT: {
    id: "FEE_OR_DEPOSIT",
    label: "Fee or deposit demand",
    weight: 0.45,
    why: "Unexpected fees or deposits before a refund or prize are a classic scam tactic.",
    patterns: [
      /\b(?:processing\s+fee|security\s+deposit|advance\s+payment|token\s+amount|refund\s+fee|customs\s+duty|clearance\s+charge)\b/i,
      /\b(?:fee\s+pay|deposit\s+karo|paisa\s+bhejo|charges\s+bharo)\b/i,
      /(?:फीस|जमा|राशि\s+भेज)/,
    ],
  },
  ARREST_THREAT: {
    id: "ARREST_THREAT",
    label: "Arrest threat",
    weight: 0.7,
    why: "No agency arrests people over a phone or video call. This is intimidation.",
    patterns: [
      /\b(?:arrest\s+warrant|warrant\s+issued|police\s+will\s+come|raid\s+at\s+home|jail|custody)\b/i,
      /\b(?:giraftari|warrant|police\s+aa\s+jayegi|jail\s+mein)\b/i,
      /(?:गिरफ्तारी|वारंट|जेल)/,
    ],
  },
  DIGITAL_ARREST: {
    id: "DIGITAL_ARREST",
    label: "Digital arrest",
    weight: 0.78,
    why: "Staying on a video call while threatening arrest is a known 'digital arrest' scam.",
    patterns: [
      /\b(?:digital\s+arrest|video\s+call\s+arrest|stay\s+on\s+(?:the\s+)?(?:video\s+)?call|keep\s+the\s+camera\s+on|do\s+not\s+disconnect)\b/i,
      /\b(?:video\s+call\s+pe\s+raho|camera\s+on\s+rakh|call\s+mat\s+kaato|digital\s+arrest)\b/i,
      /(?:डिजिटल\s+गिरफ्तारी|वीडियो\s+कॉल)/,
    ],
  },
  KYC_BLOCK_THREAT: {
    id: "KYC_BLOCK_THREAT",
    label: "KYC / account block threat",
    weight: 0.5,
    why: "KYC updates happen through official apps or branches, not urgent phone demands.",
    patterns: [
      /\b(?:kyc\s+(?:is\s+)?(?:expired|blocked|pending|update|verification)|account\s+(?:is\s+|will\s+be\s+)?(?:blocked|frozen|suspended|deactivated)|sim\s+(?:blocked|deactivated))\b/i,
      /\b(?:kyc\s+update\s+karo|account\s+band\s+ho\s+jayega|block\s+ho\s+jayega)\b/i,
      /(?:केवाईसी|खाता\s+बंद|ब्लॉक)/,
    ],
  },
  PRIZE_OR_REFUND: {
    id: "PRIZE_OR_REFUND",
    label: "Prize or refund lure",
    weight: 0.4,
    why: "Unexpected prizes or refunds you did not apply for are almost always scams.",
    patterns: [
      /\b(?:won\s+(?:a\s+)?(?:lottery|prize|reward)|lucky\s+winner|refund\s+pending|cashback\s+approved|congratulations\s+you\s+won)\b/i,
      /\b(?:lottery\s+jeet|prize\s+mila|refund\s+aaya|cashback\s+milega)\b/i,
      /(?:लॉटरी|इनाम|रिफंड)/,
    ],
  },
  LINK_OR_APP_INSTALL: {
    id: "LINK_OR_APP_INSTALL",
    label: "Link or app install",
    weight: 0.55,
    why: "Malicious links and APK installs steal banking credentials.",
    patterns: [
      /\b(?:click\s+(?:this\s+)?link|download\s+(?:the\s+)?app|install\s+(?:the\s+)?(?:apk|app)|open\s+this\s+link|send\s+you\s+a\s+link)\b/i,
      /\b(?:link\s+pe\s+click|app\s+download\s+karo|apk\s+install)\b/i,
      /(?:लिंक|ऐप\s+डाउनलोड|इंस्टॉल)/,
    ],
  },
  CARD_DETAILS: {
    id: "CARD_DETAILS",
    label: "Card details request",
    weight: 0.65,
    why: "Never share CVV, card number, or expiry on a call — banks never ask for these.",
    patterns: [
      /\b(?:cvv|cvc|card\s+number|expiry\s+date|debit\s+card\s+details|credit\s+card\s+number|16[\s-]?digit)\b/i,
      /\b(?:card\s+ka\s+number|cvv\s+batao|expiry\s+date)\b/i,
      /(?:कार्ड\s+नंबर|सीवीवी)/,
    ],
    awarenessGuard: true,
  },
};

const AWARENESS_PATTERNS = [
  /\b(?:never|won'?t|will\s+not|do\s+not|don'?t)\s+(?:ask|share|give|tell|send|request)\b/i,
  /\bbank\s+(?:will\s+)?never\s+ask\b/i,
  /\b(?:kabhi|never)\s+otp\b/i,
  /\botp\s+(?:mat|nahi|never)\s+(?:dena|share|batana|mangta|mangti|mangte)\b/i,
  /\b(?:safe|aware|remember|beware).{0,40}\b(?:otp|pin|password)\b/i,
  /\b(?:otp|pin).{0,40}\b(?:never|mat|nahi|safe|aware)\b/i,
  /\bno\s+agency\s+(?:will|asks?)\b/i,
];

function isAwarenessMessage(text) {
  const t = String(text || "");
  return AWARENESS_PATTERNS.some((re) => re.test(t));
}

function matchTactic(text, tactic) {
  if (tactic.awarenessGuard && isAwarenessMessage(text)) return null;
  for (const re of tactic.patterns) {
    const m = text.match(re);
    if (m) {
      return {
        id: tactic.id,
        label: tactic.label,
        weight: tactic.weight,
        why: tactic.why,
        snippet: m[0],
      };
    }
  }
  return null;
}

export function analyzeUtterance(text) {
  const raw = String(text || "").trim();
  if (!raw) return { text: raw, tactics: [] };

  const tactics = [];
  const seen = new Set();
  for (const tactic of Object.values(TACTICS)) {
    const hit = matchTactic(raw, tactic);
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      tactics.push(hit);
    }
  }
  return { text: raw, tactics };
}

export function combineTacticScore(weights) {
  const unique = [...new Set(weights)];
  if (unique.length === 0) return 0;
  const product = unique.reduce((acc, w) => acc * (1 - w), 1);
  return Math.round(100 * (1 - product));
}

export function analyzeCall(utterances = []) {
  const lines = utterances.map((u, i) => {
    const text = typeof u === "string" ? u : u.text;
    const analyzed = analyzeUtterance(text);
    return {
      index: i,
      text: analyzed.text,
      tactics: analyzed.tactics,
      at: typeof u === "object" && u.at ? u.at : i,
    };
  });

  const tacticMap = new Map();
  const timeline = [];

  for (const line of lines) {
    for (const t of line.tactics) {
      if (!tacticMap.has(t.id)) {
        const entry = { ...t, firstAt: line.index, firstText: line.text };
        tacticMap.set(t.id, entry);
        timeline.push(entry);
      }
    }
  }

  const weights = [...tacticMap.values()].map((t) => t.weight);
  const score = combineTacticScore(weights);

  return {
    utterances: lines,
    tactics: [...tacticMap.values()],
    timeline,
    score,
    level: riskLevel(score),
  };
}

export function riskLevel(score) {
  const s = Number(score) || 0;
  if (s >= 75) return "HANG UP NOW";
  if (s >= 50) return "LIKELY SCAM";
  if (s >= 25) return "BE CAREFUL";
  return "CALM";
}

export function riskLevelColor(level) {
  switch (level) {
    case "HANG UP NOW":
      return "var(--danger)";
    case "LIKELY SCAM":
      return "var(--danger)";
    case "BE CAREFUL":
      return "var(--caution)";
    default:
      return "var(--safe)";
  }
}

export { TACTICS };
