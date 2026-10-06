/**
 * Offline Shield engine + complaint alerts.
 * Used by web, mobile, and server so Grok-less demos always work.
 */

import { detectPlaybook } from "./playbook.js";
import { detectCoercion } from "./coercion.js";
import { buildMessageDualExplain } from "./dualExplain.js";

export const SYSTEM_PROMPT = `You are "Paytm Scam Shield", a safety assistant for UPI and digital payments in India.

Your job:
- Understand BOTH Hindi (Devanagari), English, and Hinglish input.
- Treat spelling variants / typos as the same intent (e.g. lottery, lotery, loterry, लॉटरी).
- Analyze user-provided payment text (SMS, chat, UPI request, link, voice transcript).
- Detect scam patterns: fake KYC, urgency, unknown UPI collect requests, phishing links, lottery/refund fraud, impersonation (bank/Paytm/police), prepaid verification of Rs 1/Rs 2, QR traps.
- Be practical, calm, and clear. Reply summaries in Hinglish (mix) so Hindi + English users understand.
- NEVER encourage sending money to risky parties.
- This is advisory only.
- When engines already scored the text, only rephrase reasons/hindi_summary/recommended_action; do not invent a conflicting risk level.

Output STRICTLY valid JSON only (no markdown):
{
  "risk": "Safe" | "Caution" | "High Risk",
  "score": 0-100,
  "reasons": ["..."],
  "recommended_action": "...",
  "hindi_summary": "...",
  "red_flags": ["..."],
  "safe_to_proceed": true | false,
  "suggested_ui": { "primary_button": "...", "secondary_button": "..." },
  "detected_language": "hi" | "en" | "hinglish" | "mixed"
}

Button rules:
- High Risk: Block & Ignore / Report Scam
- Caution: Verify First / Continue Anyway
- Safe: Continue to Pay / Ask Shield`;

export function buildUserPrompt(text) {
  return `Analyze this payment-related text for scam risk.
Text may be Hindi, English, Hinglish, or misspelled variants (e.g. lotery ≈ lottery, ओटीपी ≈ OTP).

Text:
"""
${text}
"""

Context:
- App: Paytm-like demo
- Locale: India
- Languages: Hindi + English + Hinglish
- Prefer Hinglish in hindi_summary`;
}

/** Demo "Paytm community complaint" registry (offline / hackathon). */
export const COMPLAINT_REGISTRY = [
  {
    entity: "fraud.collect@oksbi",
    type: "upi",
    complaints: 47,
    label: "Fake collect requests",
  },
  {
    entity: "lottery.win@paytm",
    type: "upi",
    complaints: 61,
    label: "Lottery / prize scam",
  },
  {
    entity: "refund.help@ybl",
    type: "upi",
    complaints: 35,
    label: "Fake refund help",
  },
  {
    entity: "kyc.verify@ibl",
    type: "upi",
    complaints: 52,
    label: "Fake KYC collect",
  },
  {
    entity: "cashback.now@oksbi",
    type: "upi",
    complaints: 28,
    label: "Cashback phishing",
  },
  {
    entity: "emergency.help@oksbi",
    type: "upi",
    complaints: 19,
    label: "Emergency social engineering",
  },
  {
    entity: "9876543210",
    type: "mobile",
    complaints: 23,
    label: "Repeated scam SMS sender",
  },
  {
    entity: "9123456789",
    type: "mobile",
    complaints: 14,
    label: "OTP / KYC call complaints",
  },
  {
    entity: "9988776655",
    type: "mobile",
    complaints: 31,
    label: "Impersonation complaints",
  },
];

/**
 * Curated demo messages + responses (offline).
 * Sample chips use this list.
 */
export const SCENARIO_LIST = [
  {
    id: "fakeKyc",
    label: "Fake KYC SMS",
    concepts: ["kyc", "shortlink", "upin"],
    keywords: [
      "kyc",
      "केवाईसी",
      "के वाई सी",
      "bit.ly",
      "tinyurl",
      "upi pin",
      "यूपीआई पिन",
      "पिन डाल",
    ],
    text: "Aapka Paytm KYC pending hai. 24 ghante me band ho jayega. Is link pe ₹1 verify kare: https://bit.ly/paytm-kyc-verify aur UPI PIN dale.",
    response: {
      risk: "High Risk",
      score: 92,
      reasons: [
        "Urgent KYC threat + short link is a common scam pattern",
        "Asks for UPI PIN on an external link",
        "₹1 verification is often used to steal account access",
      ],
      recommended_action: "Link mat kholo. UPI PIN kahin mat dalo. Sirf official Paytm app use karo.",
      hindi_summary: "Ye KYC SMS scam lag raha hai. Link/PIN ignore karo.",
      red_flags: ["urgency", "shortened_link", "upi_pin_request"],
      safe_to_proceed: false,
    },
  },
  {
    id: "emergencyUpi",
    label: "Emergency UPI",
    concepts: ["emergency", "upi"],
    keywords: [
      "emergency",
      "इमरजेंसी",
      "आपातकाल",
      "phone chori",
      "फोन चोरी",
      "emergency.help",
      "madad",
      "मदद",
    ],
    text: "Bhai emergency hai, phone chori ho gaya. Is naye number se baat kar raha hoon. Turant 5000 is UPI pe bhej do: emergency.help@oksbi",
    response: {
      risk: "Caution",
      score: 64,
      reasons: [
        "Urgent money request from a new/unknown UPI",
        "Lost phone story is common social engineering",
        "Identity not verified on known number",
      ],
      recommended_action: "Purane saved number pe call karke verify karo.",
      hindi_summary: "Emergency ho sakti hai, lekin pehle verify karo. Turant mat bhejo.",
      red_flags: ["urgency", "new_upi_id"],
      safe_to_proceed: false,
    },
  },
  {
    id: "electricityBill",
    label: "Electricity bill",
    concepts: ["electricity", "biller"],
    keywords: [
      "electricity",
      "बिजली",
      "बिजली बिल",
      "state electricity",
      "consumer no",
      "बिलर",
      "biller",
    ],
    text: "Electricity bill due: ₹842 for consumer no. thr-22019. Pay via official biller 'State Electricity Board' in Paytm. Due date 5 Oct.",
    response: {
      risk: "Safe",
      score: 18,
      reasons: [
        "Normal utility bill payment request",
        "Official biller flow mentioned",
        "No PIN / phishing language",
      ],
      recommended_action: "Official biller se pay karo; amount/consumer no. confirm karo.",
      hindi_summary: "Normal bill payment lagta hai. Official biller se pay karo.",
      red_flags: [],
      safe_to_proceed: true,
    },
  },
  {
    id: "lottery",
    label: "Lottery prize",
    concepts: ["lottery", "prize", "congrats"],
    keywords: [
      "lottery",
      "lotery",
      "loterry",
      "lotary",
      "लॉटरी",
      "लाटरी",
      "jackpot",
      "जैकपॉट",
      "prize",
      "इनाम",
      "congratulations",
      "congrats",
      "बधाई",
      "jeet",
      "जीत",
    ],
    text: "Congratulations! Aap jeet gaye ₹5,00,000 Paytm lucky draw. Claim karne ke liye lottery.win@paytm pe ₹99 processing fee bhejo.",
    response: {
      risk: "High Risk",
      score: 95,
      reasons: [
        "Prize/lottery + fee-first payment is classic fraud",
        "Personal UPI used instead of official claim flow",
        "No legitimate lottery asks advance fee on chat",
      ],
      recommended_action: "Ignore and block. Koi processing fee mat bhejo.",
      hindi_summary: "Lottery/prize scam hai. Processing fee bilkul mat bhejo.",
      red_flags: ["lottery", "advance_fee", "too_good_to_be_true"],
      safe_to_proceed: false,
    },
  },
  {
    id: "lotteryHindi",
    label: "लॉटरी स्कैम (Hindi)",
    concepts: ["lottery", "prize", "congrats"],
    keywords: ["लॉटरी", "इनाम", "बधाई", "प्रोसेसिंग फीस", "जीत गए"],
    text: "बधाई हो! आप लॉटरी में ₹2 लाख जीत गए हैं। क्लेम करने के लिए lottery.win@paytm पर ₹99 प्रोसेसिंग फीस भेजें।",
    response: {
      risk: "High Risk",
      score: 96,
      reasons: [
        "Hindi lottery/prize message with advance fee",
        "Asks payment to personal UPI before claim",
        "Classic prize scam pattern (Hindi + English same intent)",
      ],
      recommended_action: "इग्नोर करें। कोई फीस न भेजें।",
      hindi_summary: "यह लॉटरी स्कैम है। ₹99 फीस बिल्कुल न भेजें।",
      red_flags: ["lottery", "advance_fee", "hindi_scam_sms"],
      safe_to_proceed: false,
    },
  },
  {
    id: "refundScam",
    label: "Fake refund",
    concepts: ["refund"],
    keywords: [
      "refund",
      "रिफंड",
      "वापसी",
      "extra amount",
      "गलत क्रेडिट",
      "legal action",
      "कानूनी कार्रवाई",
      "refund.help",
    ],
    text: "Sir, aapke account me extra ₹12,000 galat credit ho gaya. Refund help ke liye refund.help@ybl pe reverse payment kar do warna legal action.",
    response: {
      risk: "High Risk",
      score: 90,
      reasons: [
        "Banks/Paytm never ask reverse payment to random UPI for 'wrong credit'",
        "Legal-threat urgency is a scam tactic",
        "Refund must go through official support, not chat UPI",
      ],
      recommended_action: "Pay mat karo. Official Paytm/Bank app se support raise karo.",
      hindi_summary: "Fake refund scam. Is UPI pe kuch mat bhejo.",
      red_flags: ["refund_fraud", "legal_threat", "urgency"],
      safe_to_proceed: false,
    },
  },
  {
    id: "policeImpersonation",
    label: "Police / cyber cell",
    concepts: ["police", "upin", "otp"],
    keywords: [
      "cyber cell",
      "साइबर सेल",
      "police",
      "पुलिस",
      "arrest",
      "गिरफ्तारी",
      "warrant",
      "वारंट",
      "mule account",
      "video call",
    ],
    text: "Main Cyber Cell se baat kar raha hoon. Aapka account mule case me hai. Arrest avoid karne ke liye abhi video call pe UPI PIN share karo aur cashback.now@oksbi pe ₹1 test bhejo.",
    response: {
      risk: "High Risk",
      score: 97,
      reasons: [
        "Police/cyber cell never ask UPI PIN on call",
        "Test payment + PIN share is account-takeover pattern",
        "Impersonation + fear tactics",
      ],
      recommended_action: "Call cut karo. PIN mat do. Local police station / official helpline se verify karo.",
      hindi_summary: "Cyber cell scam. PIN/payment bilkul mat do.",
      red_flags: ["impersonation", "upi_pin_request", "fear"],
      safe_to_proceed: false,
    },
  },
  {
    id: "jobFee",
    label: "Job / WFH fee",
    concepts: ["job"],
    keywords: [
      "work from home",
      "registration fee",
      "job offer",
      "form fee",
      "नौकरी",
      "जॉब",
      "रजिस्ट्रेशन फीस",
      "घर बैठे काम",
    ],
    text: "Work from home job confirmed. Join karne se pehle ₹1500 registration fee is number pe bhejo 9876543210 (UPI: job.hr@ybl).",
    response: {
      risk: "High Risk",
      score: 88,
      reasons: [
        "Legitimate employers rarely ask registration fee on UPI",
        "Unknown mobile/UPI for job fee is high risk",
        "Advance-fee job fraud is common",
      ],
      recommended_action: "Fee mat bhejo. Company official career portal se verify karo.",
      hindi_summary: "Job fee scam ho sakta hai. Pehle verify, fee mat do.",
      red_flags: ["advance_fee", "job_fraud"],
      safe_to_proceed: false,
    },
  },
  {
    id: "qrTrap",
    label: "QR scan pay",
    concepts: ["qr"],
    keywords: [
      "qr scan",
      "scan karke",
      "क्यूआर",
      "क्यू आर",
      "स्कैन",
      "receive karne",
      "पैसे लेने",
    ],
    text: "Payment receive karne ke liye ye QR scan karke ₹1 pay karo, warna amount nahi aayega. QR UPI: kyc.verify@ibl",
    response: {
      risk: "High Risk",
      score: 91,
      reasons: [
        "Receiving money never requires you to scan and pay first",
        "₹1 QR trap can trigger collect/mandate tricks",
        "Unknown UPI in QR flow",
      ],
      recommended_action: "QR scan karke pay mat karo. Receive ke liye sirf apna QR share karo.",
      hindi_summary: "QR trap scam. Receive ke liye aapko pay nahi karna padta.",
      red_flags: ["qr_trap", "reverse_social_engineering"],
      safe_to_proceed: false,
    },
  },
  {
    id: "otpShare",
    label: "OTP share ask",
    concepts: ["otp"],
    keywords: [
      "otp",
      "ओटीपी",
      "ओ टी पी",
      "otp bata",
      "otp share",
      "otp bhej",
      "ओटीपी बता",
      "ओटीपी भेज",
    ],
    text: "Paytm team: aapka transaction stuck hai. OTP bata do 9988776655 pe WhatsApp karke, hum refund process kar denge.",
    response: {
      risk: "High Risk",
      score: 96,
      reasons: [
        "OTP sharing gives attackers full account control",
        "Official Paytm never asks OTP on WhatsApp/call",
        "Unknown mobile used for 'support'",
      ],
      recommended_action: "OTP kisi ko mat do. Official in-app support use karo.",
      hindi_summary: "OTP scam. OTP kabhi share mat karo.",
      red_flags: ["otp_request", "impersonation"],
      safe_to_proceed: false,
    },
  },
  {
    id: "unknownRent",
    label: "New landlord UPI",
    concepts: ["rent"],
    keywords: [
      "rent",
      "किराया",
      "new landlord",
      "owner changed",
      "मकान मालिक",
      "ब्रोकर",
      "broker",
    ],
    text: "Broker: owner change ho gaya. Is mahine ka rent ₹18,000 is naye UPI pe bhej dena: new.owner@oksbi",
    response: {
      risk: "Caution",
      score: 58,
      reasons: [
        "Payee changed suddenly without written proof",
        "Broker-mediated UPI change is often abused",
        "Need landlord confirmation on known channel",
      ],
      recommended_action: "Owner se known number/email pe confirm karo, phir pay karo.",
      hindi_summary: "Naya rent UPI — pehle owner verify karo.",
      red_flags: ["payee_change", "unverified_upi"],
      safe_to_proceed: false,
    },
  },
  {
    id: "friendSplit",
    label: "Friend split bill",
    concepts: ["split"],
    keywords: ["split bill", "dinner split", "mera share", "बिल बांटो", "शेयर"],
    text: "Yaar yesterday dinner ka mera share ₹460 hai. Mere saved UPI rahul.sharma@oksbi pe bhej dena jab free ho.",
    response: {
      risk: "Caution",
      score: 42,
      reasons: [
        "Looks like normal peer payment but verify name match",
        "Confirm with friend on call/chat before paying large/unusual amounts",
        "No classic scam keywords detected",
      ],
      recommended_action: "UPI name check karo aur friend se ek baar confirm karke pay karo.",
      hindi_summary: "Normal split lagta hai — UPI name confirm karke bhejo.",
      red_flags: ["p2p_unverified"],
      safe_to_proceed: false,
    },
  },
  {
    id: "mobileRecharge",
    label: "Mobile recharge",
    concepts: ["recharge"],
    keywords: [
      "recharge",
      "रिचार्ज",
      "jio",
      "airtel",
      "vi prepaid",
      "प्रीपेड",
    ],
    text: "Recharge Jio prepaid 9876512345 for ₹299 using Paytm Recharge. No cashback code needed.",
    response: {
      risk: "Safe",
      score: 15,
      reasons: [
        "Standard prepaid recharge request",
        "Uses official recharge flow context",
        "No phishing link or PIN ask",
      ],
      recommended_action: "Paytm Recharge section se number confirm karke recharge karo.",
      hindi_summary: "Normal recharge lagta hai. Number check karke official recharge use karo.",
      red_flags: [],
      safe_to_proceed: true,
    },
  },
  {
    id: "gasBooking",
    label: "Gas booking",
    concepts: ["gas"],
    keywords: [
      "gas cylinder",
      "indane",
      "bharatgas",
      "hp gas",
      "गैस",
      "गैस बुकिंग",
      "सिलेंडर",
    ],
    text: "Indane gas booking amount ₹1103. Pay via official Gas booking in Paytm for consumer 458821.",
    response: {
      risk: "Safe",
      score: 16,
      reasons: [
        "Official gas booking / biller style payment",
        "Consumer number present",
        "No unknown personal UPI pressure",
      ],
      recommended_action: "Official gas booking option se pay karo.",
      hindi_summary: "Normal gas booking payment. Official option use karo.",
      red_flags: [],
      safe_to_proceed: true,
    },
  },
  {
    id: "familyTransfer",
    label: "Family transfer",
    concepts: ["family"],
    keywords: [
      "mummy ko",
      "papa ko",
      "family transfer",
      "मम्मी",
      "पापा",
      "माताजी",
      "परिवार",
    ],
    text: "Mummy ko ₹2000 bhejna hai unke saved UPI mum.house@oksbi pe. Note: monthly help.",
    response: {
      risk: "Safe",
      score: 22,
      reasons: [
        "Known family transfer pattern",
        "Saved UPI mentioned",
        "No urgency / phishing indicators",
      ],
      recommended_action: "Saved contact select karke amount confirm karke pay karo.",
      hindi_summary: "Family transfer normal lagta hai. Saved contact se pay karo.",
      red_flags: [],
      safe_to_proceed: true,
    },
  },

  {
    id: "hindiDigitalArrest",
    label: "डिजिटल अरेस्ट (Hindi)",
    concepts: ["police", "otp"],
    keywords: ["डिजिटल अरेस्ट", "साइबर सेल", "कॉल पर रहो", "किसी को मत बताना", "एनीडेस्क", "ओटीपी"],
    text: "नमस्ते, मैं साइबर सेल से बात कर रहा हूँ। आपके नाम पर ड्रग पार्सल है। कॉल पर रहो, परिवार को मत बताना। AnyDesk इंस्टॉल करो और ओटीपी बताओ नहीं तो डिजिटल अरेस्ट।",
    response: {
      risk: "High Risk",
      score: 96,
      reasons: [
        "डिजिटल अरेस्ट + साइबर सेल impersonation",
        "Secrecy + screen-share coaching pattern",
        "OTP मांगना — कभी भी OTP मत दो",
      ],
      recommended_action: "कॉल काटो। AnyDesk बंद करो। 1930 पर शिकायत करो।",
      hindi_summary: "ये क्लासिक डिजिटल अरेस्ट स्कैम है। कुछ मत भेजो।",
      red_flags: ["digital_arrest", "coaching", "otp_request"],
      safe_to_proceed: false,
    },
  },
  {
    id: "tamilCyber",
    label: "Cyber cell (Tamil)",
    concepts: ["police", "otp"],
    keywords: ["சைபர் செல்", "போலீஸ்", "OTP", "UPI", "கைது", "cyber", "cell"],
    text: "வணக்கம், இது சைபர் செல். உங்கள் பெயரில் parcel பிடிபட்டது. Call-ல் இருங்கள், வீட்டில் சொல்லாதீர்கள். AnyDesk install செய்து OTP அனுப்புங்கள் இல்லையெனில் digital arrest.",
    response: {
      risk: "High Risk",
      score: 95,
      reasons: [
        "Tamil cyber-cell impersonation + secrecy",
        "AnyDesk / OTP harvest pattern",
        "Digital arrest threat",
      ],
      recommended_action: "Call cut pannunga. AnyDesk remove pannunga. 1930-ku complaint.",
      hindi_summary: "Tamil digital-arrest scam. OTP/PIN mat do. 1930 pe report karo.",
      red_flags: ["digital_arrest", "regional_scam", "otp_request"],
      safe_to_proceed: false,
    },
  },
  {
    id: "bengaliRefund",
    label: "রিফান্ড স্ক্যাম (Bengali)",
    concepts: ["refund", "otp"],
    keywords: ["রিফান্ড", "টাকা ফেরত", "UPI", "পিন", "OTP", "refund"],
    text: "স্যার, ভুল করে আপনার অ্যাকাউন্টে ৫০০০ টাকা চলে গেছে। দয়া করে refund.help@ybl এ UPI পিন দিয়ে টাকা ফেরত পাঠান। এখনই না হলে কেস হবে।",
    response: {
      risk: "High Risk",
      score: 90,
      reasons: [
        "Wrong-credit refund demand in Bengali",
        "Asks for UPI PIN to 'return' money",
        "Urgency / case threat",
      ],
      recommended_action: "PIN/OTP deben na. Official bank app theke verify korun. 1930-e report.",
      hindi_summary: "Bengali wrong-transfer scam. PIN mat do, verify karke report karo.",
      red_flags: ["refund_scam", "upi_pin_request", "regional_scam"],
      safe_to_proceed: false,
    },
  },
  {
    id: "marathiKyc",
    label: "KYC (Marathi)",
    concepts: ["kyc", "shortlink"],
    keywords: ["केवायसी", "खाते ब्लॉक", "लिंक", "पिन", "KYC", "bit.ly"],
    text: "नमस्कार, तुमचे Paytm KYC पूर्ण नाही. २४ तासांत खाते ब्लॉक होईल. या लिंकवर ₹१ द्या व UPI पिन टाका: https://bit.ly/paytm-kyc-mr",
    response: {
      risk: "High Risk",
      score: 93,
      reasons: [
        "Marathi KYC urgency + short link",
        "₹1 verify + UPI PIN request",
        "Classic account-block phishing",
      ],
      recommended_action: "Link उघडू नका. फक्त अधिकृत Paytm अॅप वापरा. 1930 वर तक्रार.",
      hindi_summary: "Marathi KYC phishing. Link/PIN ignore karo.",
      red_flags: ["kyc_phishing", "shortened_link", "regional_scam"],
      safe_to_proceed: false,
    },
  },
  {
    id: "complaintDemo",
    label: "Flagged UPI (complaints)",
    concepts: ["complaint_upi"],
    keywords: ["fraud.collect@oksbi"],
    text: "Please pay ₹2500 to fraud.collect@oksbi for shop order #4481 today.",
    response: {
      risk: "Caution",
      score: 55,
      reasons: [
        "Unknown merchant UPI for shop order",
        "No invoice / official collection link provided",
        "Verify merchant before paying",
      ],
      recommended_action: "Merchant verify karo. Complaint alert bhi check karo.",
      hindi_summary: "Unknown shop UPI — verify karke hi pay karna.",
      red_flags: ["unknown_merchant"],
      safe_to_proceed: false,
    },
  },
];

/** Back-compat object map for older UI code. */
export const SCENARIOS = Object.fromEntries(
  SCENARIO_LIST.map((s) => [s.id, s])
);

export function normalizeResult(raw = {}) {
  let risk = String(raw.risk || "Caution");
  if (/high/i.test(risk)) risk = "High Risk";
  else if (/safe/i.test(risk)) risk = "Safe";
  else risk = "Caution";

  const scoreNum = Number(raw.score);
  const score = Number.isFinite(scoreNum)
    ? Math.max(0, Math.min(100, Math.round(scoreNum)))
    : risk === "Safe"
      ? 20
      : risk === "High Risk"
        ? 85
        : 55;

  const safe_to_proceed =
    typeof raw.safe_to_proceed === "boolean"
      ? raw.safe_to_proceed
      : risk === "Safe";

  const suggested_ui =
    risk === "Safe"
      ? { primary_button: "Continue to Pay", secondary_button: "Ask Shield" }
      : risk === "High Risk"
        ? { primary_button: "Block & Ignore", secondary_button: "Report Scam" }
        : { primary_button: "Verify First", secondary_button: "Continue Anyway" };

  return {
    risk,
    score,
    reasons:
      Array.isArray(raw.reasons) && raw.reasons.length
        ? raw.reasons.slice(0, 6).map(String)
        : ["Need more context"],
    recommended_action: String(
      raw.recommended_action || "Review carefully before paying."
    ),
    hindi_summary: String(
      raw.hindi_summary || "Shield ne is message ko check kiya."
    ),
    red_flags: Array.isArray(raw.red_flags) ? raw.red_flags.map(String) : [],
    safe_to_proceed,
    suggested_ui: {
      primary_button:
        raw.suggested_ui?.primary_button || suggested_ui.primary_button,
      secondary_button:
        raw.suggested_ui?.secondary_button || suggested_ui.secondary_button,
    },
    detected_language: raw.detected_language || undefined,
    matched_terms: Array.isArray(raw.matched_terms) ? raw.matched_terms : [],
  };
}

export function extractEntities(text = "") {
  const upiMatches = text.match(/[\w.-]+@[\w]+/gi) || [];
  const mobileMatches = text.match(/(?:\+91[-\s]?)?[6-9]\d{9}/g) || [];
  const mobiles = mobileMatches.map((m) => m.replace(/\D/g, "").slice(-10));
  return {
    upis: [...new Set(upiMatches.map((u) => u.toLowerCase()))],
    mobiles: [...new Set(mobiles)],
  };
}

/**
 * Additive alert only — does not replace existing risk buttons/flow.
 * If multiple complaints found, attaches complaint_alert + extra reason.
 */
export function enrichWithComplaints(result, text = "") {
  const base = normalizeResult(result);
  const { upis, mobiles } = extractEntities(text);
  const hits = [];

  for (const row of COMPLAINT_REGISTRY) {
    if (row.type === "upi" && upis.includes(row.entity.toLowerCase())) {
      hits.push(row);
    }
    if (row.type === "mobile" && mobiles.includes(row.entity)) {
      hits.push(row);
    }
  }

  if (!hits.length) {
    return {
      ...base,
      complaint_alert: {
        found: false,
        hits: [],
        message_hi: "",
        message_en: "",
      },
    };
  }

  const top = [...hits].sort((a, b) => b.complaints - a.complaints)[0];
  const message_hi = `Alert: ${top.entity} pe Paytm users ki ${top.complaints}+ complaints hain (${top.label}). Extra careful raho / prefer avoid.`;
  const message_en = `Community alert: ${top.entity} has ${top.complaints}+ user complaints (${top.label}).`;

  const reasons = [
    message_en,
    ...base.reasons.filter((r) => r !== message_en),
  ].slice(0, 6);

  const red_flags = Array.from(
    new Set([...(base.red_flags || []), "multiple_complaints", top.type + "_flagged"])
  );

  // Soft score bump only; keep original risk/buttons unless already risky.
  // Existing primary flow intentionally unchanged.
  const score = Math.min(100, base.score + (top.complaints >= 20 ? 12 : 6));

  return {
    ...base,
    score,
    reasons,
    red_flags,
    complaint_alert: {
      found: true,
      hits: hits.map((h) => ({
        entity: h.entity,
        type: h.type,
        complaints: h.complaints,
        label: h.label,
      })),
      primary_entity: top.entity,
      complaint_count: top.complaints,
      message_hi,
      message_en,
    },
  };
}

function scoreKeywordMatch(text, keywords = []) {
  let score = 0;
  const matched = [];
  for (const k of keywords) {
    const hit = textIncludesKeyword(text, k);
    if (hit) {
      score += hit.fuzzy ? 0.85 : 1;
      matched.push(hit.matched || k);
    }
  }
  return { score, matched };
}

/**
 * Concept families with English typos + Hindi spellings.
 * Used so "lotery" / "loterry" / "लॉटरी" map to lottery.
 */
export const CONCEPT_VARIANTS = {
  lottery: [
    "lottery",
    "lotery",
    "loterry",
    "lotary",
    "lotteri",
    "loteri",
    "लॉटरी",
    "लाटरी",
    "लोटरी",
  ],
  prize: ["prize", "prise", "priz", "इनाम", "इनाम"],
  congrats: [
    "congratulations",
    "congratulation",
    "congrats",
    "congraulations",
    "बधाई",
    "बधाई हो",
  ],
  kyc: ["kyc", "kycpending", "केवाईसी", "के वाई सी", "কেওয়াইসি", "కెవైసి", "केवायसी"],
  otp: ["otp", "otpp", "ओटीपी", "ओ टी पी"],
  upin: ["upipin", "upin", "यूपीआईपिन", "यूपीआई पिन", "pinbatao", "पिन"],
  refund: ["refund", "refnd", "refond", "रिफंड", "वापसी"],
  emergency: ["emergency", "emergeny", "emrgency", "इमरजेंसी", "आपातकाल"],
  police: ["police", "polce", "पुलिस", "cybercell", "साइबरसेल", "साइबर सेल", "சைபர் செல்", "సైబర్ సెల్", "সাইবার সেল", "सायबर सेल"],
  qr: ["qrcode", "qrscan", "क्यूआर", "स्कैन"],
  job: ["joboffer", "wfh", "नौकरी", "रजिस्ट्रेशनफीस"],
  recharge: ["recharge", "rechage", "rechrg", "रिचार्ज"],
  electricity: ["electricity", "electicity", "बिजली", "बिजलीबिल"],
  biller: ["biller", "biler", "बिलर"],
  rent: ["rent", "किराया"],
  gas: ["gas", "गैस", "सिलेंडर", "indane"],
  family: ["mummy", "papa", "मम्मी", "पापा", "माताजी"],
  shortlink: ["bitly", "tinyurl", "cuttly"],
};

function levenshtein(a, b) {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[s.length][t.length];
}

/** Collapse repeated letters: loterry -> lotery */
function collapseRepeats(word = "") {
  return String(word).replace(/(.)\1+/g, "$1");
}

function normalizeLatinToken(token = "") {
  return collapseRepeats(
    String(token)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}@.]/gu, "")
  );
}

function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}@._-]+/u)
    .map((t) => t.trim())
    .filter(Boolean);
}

function fuzzyTokenMatch(token, target) {
  const a = normalizeLatinToken(token);
  const b = normalizeLatinToken(target);
  if (!a || !b) return false;
  if (a === b) return true;

  // Very short tokens: exact only (avoids fee≈..., bill≈bitly)
  if (a.length <= 3 || b.length <= 3) return false;

  // Substring only when both long enough and similar length
  if (a.length >= 5 && b.length >= 5) {
    if (a.includes(b) || b.includes(a)) {
      const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
      if (ratio >= 0.72) return true;
    }
  }

  if (Math.abs(a.length - b.length) > 2) return false;

  const allow = Math.min(a.length, b.length) <= 5 ? 1 : 2;
  return levenshtein(a, b) <= allow;
}

function textIncludesKeyword(text, keyword) {
  const raw = String(text || "");
  const key = String(keyword || "").trim();
  if (!key) return null;
  const lower = raw.toLowerCase();
  if (lower.includes(key.toLowerCase())) {
    return { matched: key, fuzzy: false };
  }

  // Devanagari / exact non-latin already handled by includes above after lowercasing
  // Latin fuzzy on tokens
  const keyNorm = normalizeLatinToken(key);
  if (!keyNorm || /[^\u0000-\u007f]/.test(key)) {
    // For Hindi phrases try direct includes on original
    if (raw.includes(key)) return { matched: key, fuzzy: false };
    return null;
  }

  const tokens = tokenize(raw);
  for (const tok of tokens) {
    if (fuzzyTokenMatch(tok, keyNorm)) {
      return { matched: tok, fuzzy: tok !== keyNorm };
    }
  }

  // Multi-word keyword: check collapsed text
  const collapsedText = collapseRepeats(lower.replace(/\s+/g, ""));
  const collapsedKey = collapseRepeats(keyNorm);
  if (collapsedKey && collapsedText.includes(collapsedKey)) {
    return { matched: key, fuzzy: true };
  }
  return null;
}

function detectLanguage(text = "") {
  const hasHindi = /[\u0900-\u097F]/.test(text);
  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
  const hasBengali = /[\u0980-\u09FF]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (hasTamil) return hasLatin ? "ta-en" : "ta";
  if (hasTelugu) return hasLatin ? "te-en" : "te";
  if (hasBengali) return hasLatin ? "bn-en" : "bn";
  if (hasHindi && hasLatin) return "hinglish";
  if (hasHindi) return "hi";
  if (hasLatin) return "en";
  return "mixed";
}

function findConceptHits(text = "") {
  const hits = [];
  for (const [concept, variants] of Object.entries(CONCEPT_VARIANTS)) {
    for (const variant of variants) {
      const hit = textIncludesKeyword(text, variant);
      if (hit) {
        hits.push({
          concept,
          variant,
          matched: hit.matched,
          fuzzy: hit.fuzzy,
        });
        break;
      }
    }
  }
  return hits;
}

export function pickMockByText(text = "") {
  const trimmed = String(text || "").trim();
  const lang = detectLanguage(trimmed);

  if (!trimmed) {
    return enrichWithComplaints(
      {
        risk: "Caution",
        score: 45,
        reasons: ["Empty input"],
        recommended_action: "Message paste karo / Paste a message.",
        hindi_summary: "Koi text nahi mila.",
        red_flags: ["empty"],
        safe_to_proceed: false,
        detected_language: lang,
      },
      trimmed
    );
  }

  const conceptHits = findConceptHits(trimmed);
  const conceptSet = new Set(conceptHits.map((h) => h.concept));

  let best = null;
  let bestScore = 0;
  let bestMatched = [];

  for (const scenario of SCENARIO_LIST) {
    const kw = scoreKeywordMatch(trimmed, scenario.keywords || []);
    let score = kw.score;
    const matched = [...kw.matched];

    for (const c of scenario.concepts || []) {
      if (conceptSet.has(c)) {
        score += 1.25;
        const hit = conceptHits.find((h) => h.concept === c);
        if (hit) matched.push(`${hit.matched}≈${c}`);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = scenario;
      bestMatched = matched;
    }
  }

  // Strong generic fallbacks using concepts
  if (bestScore < 0.8) {
    if (conceptSet.has("otp") || conceptSet.has("upin") || conceptSet.has("shortlink")) {
      best = SCENARIO_LIST.find((x) => x.id === "otpShare") ||
        SCENARIO_LIST.find((x) => x.id === "fakeKyc");
      bestScore = 1;
    } else if (conceptSet.has("lottery") || conceptSet.has("prize") || conceptSet.has("congrats")) {
      best = SCENARIO_LIST.find((x) => x.id === "lottery");
      bestScore = 1;
    } else if (conceptSet.has("refund")) {
      best = SCENARIO_LIST.find((x) => x.id === "refundScam");
      bestScore = 1;
    } else if (conceptSet.has("police")) {
      best = SCENARIO_LIST.find((x) => x.id === "policeImpersonation");
      bestScore = 1;
    } else if (conceptSet.has("electricity") || conceptSet.has("biller") || conceptSet.has("recharge")) {
      best = SCENARIO_LIST.find((x) => x.id === "electricityBill");
      bestScore = 1;
    }
  }

  if (!best || bestScore < 0.8) {
    return enrichWithComplaints(
      {
        risk: "Caution",
        score: 50,
        reasons: [
          "Exact template match nahi mila / No strong template match",
          "Generic check: link/UPI/OTP carefully verify karo",
          "More detail se better score milta hai",
        ],
        recommended_action: "Poora SMS/chat + UPI/mobile ke saath analyze karo.",
        hindi_summary: "Clear scam signal weak hai — pehle verify karke aage badho.",
        red_flags: ["unmatched_template"],
        safe_to_proceed: false,
        detected_language: lang,
        matched_terms: conceptHits.map((h) => h.matched),
      },
      trimmed
    );
  }

  const response = {
    ...best.response,
    detected_language: lang,
    matched_terms: Array.from(new Set(bestMatched)).slice(0, 8),
  };

  // Mention fuzzy catch in reasons when useful (additive)
  const fuzzyHits = conceptHits.filter((h) => h.fuzzy);
  if (fuzzyHits.length) {
    const tip = `Similar/typo text detected: ${fuzzyHits
      .map((h) => `"${h.matched}" ≈ ${h.concept}`)
      .join(", ")}`;
    response.reasons = [tip, ...(best.response.reasons || [])].slice(0, 6);
  }

  return enrichWithComplaints(response, trimmed);
}

/** Attach complaint enrichment, playbook, coercion and dual explain to any result. */
export function finalizeAnalysis(result, text, meta = {}) {
  const enriched = enrichWithComplaints(result || {}, text);
  const lang = result?.detected_language || detectLanguage(text);
  const coercion = detectCoercion(text);
  const playbook = detectPlaybook(text, {
    collect: Boolean(enriched.payment?.collect || /collect|request money/i.test(String(text || ""))),
    coercionRemote: coercion.flags.some((f) => f.id === "screen_share"),
    coercionAuthority: coercion.flags.some((f) => f.id === "authority_fear"),
  });

  let score = Number(enriched.score) || 0;
  let risk = enriched.risk;
  const red = [...(enriched.red_flags || [])];
  const reasons = [...(enriched.reasons || [])];

  if (coercion.detected) {
    const serious = coercion.flags.filter((f) =>
      ["stay_on_call", "secrecy", "screen_share", "authority_fear", "otp_pin", "coaching", "secrecy_hi", "stay_on_call_hi", "otp_pin_hi", "screen_share_regional", "authority_ta"].includes(f.id)
    );
    const boost = serious.length
      ? Math.min(40, serious.reduce((s, f) => s + f.weight, 0))
      : Math.min(8, coercion.scoreBoost); // urgency-alone stays mild
    score = Math.min(100, score + boost);
    for (const f of coercion.flags) {
      if (!red.includes(f.id)) red.push(f.id);
      reasons.unshift(f.labelHi + " / " + f.label);
    }
    // Escalate verdict only when coaching / remote-access / PIN harvest is present
    if (coercion.coachingSuspected || serious.some((f) => ["screen_share", "otp_pin", "authority_fear"].includes(f.id))) {
      if (score >= 55) risk = "High Risk";
      else if (risk === "Safe") risk = "Caution";
    } else if (score >= 35 && risk === "Safe") {
      risk = "Caution";
    }
  }

  if (playbook && !red.includes("playbook:" + playbook.playbookId)) {
    red.push("playbook:" + playbook.playbookId);
    reasons.unshift(playbook.youAreHereHi || playbook.youAreHere);
  }

  // Recompute safe_to_proceed from risk
  const safe_to_proceed = risk === "Safe";
  const suggested_ui =
    risk === "High Risk"
      ? { primary_button: "Block & Ignore", secondary_button: "Report Scam" }
      : risk === "Caution"
        ? { primary_button: "Verify First", secondary_button: "Continue Anyway" }
        : enriched.suggested_ui;

  const base = {
    ...enriched,
    risk,
    score,
    reasons: reasons.slice(0, 8),
    red_flags: red,
    safe_to_proceed,
    suggested_ui: suggested_ui || enriched.suggested_ui,
    detected_language: lang,
    matched_terms: result?.matched_terms || enriched.matched_terms || [],
    source: meta.source || enriched.source || "mock",
    message: meta.message || enriched.message,
    model: meta.model,
    coercion: coercion.detected ? coercion : undefined,
    playbook: playbook || undefined,
  };

  base.dual = buildMessageDualExplain(base);
  return base;
}


/** Keep engine-owned risk/score/flags; LLM may only supply user-facing wording. */
export function applyLlmRephrase(engineBase, llmRaw = {}) {
  const base = normalizeResult(engineBase);
  const reasons =
    Array.isArray(llmRaw.reasons) && llmRaw.reasons.length
      ? llmRaw.reasons.slice(0, 5).map(String)
      : base.reasons;
  return {
    ...base,
    reasons,
    recommended_action: String(
      llmRaw.recommended_action || base.recommended_action
    ).slice(0, 400),
    hindi_summary: String(llmRaw.hindi_summary || base.hindi_summary).slice(0, 600),
  };
}

export function safeParseJson(content) {
  try {
    const cleaned = String(content || "")
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}
