/**
 * Paytm Scam Shield - mock scenarios for offline / fallback demo
 * Keep this response shape identical to live Grok JSON output.
 */

export const SYSTEM_PROMPT = `You are "Paytm Scam Shield", a safety assistant for UPI and digital payments in India.

Your job:
- Analyze user-provided payment text (SMS, chat, UPI request, link, voice transcript).
- Detect scam patterns: fake KYC, urgency, unknown UPI collect requests, phishing links, lottery/refund fraud, impersonation (bank/Paytm/police), prepaid "verification" of ₹1/₹2, QR traps.
- Be practical, calm, and clear. Prefer Hinglish for user-facing summaries.
- NEVER encourage sending money to risky parties.
- Do NOT invent bank policies. If unsure, mark Caution and ask for more details.
- This is advisory only; final payment decision is user's.

Output STRICTLY valid JSON only (no markdown, no extra text):
{
  "risk": "Safe" | "Caution" | "High Risk",
  "score": 0-100,
  "reasons": ["short reason 1", "short reason 2", "short reason 3"],
  "recommended_action": "one clear next step",
  "hindi_summary": "2-3 short Hinglish/Hindi lines for the user",
  "red_flags": ["flag1", "flag2"],
  "safe_to_proceed": true | false,
  "suggested_ui": {
    "primary_button": "Block / Verify / Continue to Pay",
    "secondary_button": "Ask more / Report"
  }
}

Scoring guide:
- 0-30 Safe
- 31-69 Caution
- 70-100 High Risk

If input is incomplete, still return JSON with Caution and ask what is missing inside hindi_summary.`;

export function buildUserPrompt(text) {
  return `Analyze this payment-related text for scam risk.

Text:
"""
${text}
"""

Context (optional):
- App: Paytm-like demo
- Locale: India
- Language preference: Hinglish`;
}

export const SCENARIOS = {
  highRisk: {
    id: "highRisk",
    label: "Fake KYC SMS",
    text: "Aapka Paytm KYC pending hai. 24 ghante me band ho jayega. Is link pe ₹1 verify kare: https://bit.ly/paytm-kyc-verify aur UPI PIN dale.",
    response: {
      risk: "High Risk",
      score: 92,
      reasons: [
        "Urgent KYC threat + short link is a common scam pattern",
        "Asks for UPI PIN on an external link — Paytm never asks PIN on random links",
        "₹1 'verification' is often used to steal account access",
      ],
      recommended_action:
        "Do not click the link. Do not enter UPI PIN. Open official Paytm app only and ignore this SMS.",
      hindi_summary:
        "Ye message scam lag raha hai. Link mat kholo aur UPI PIN kahin mat dalo. Sirf official Paytm app se KYC check karo.",
      red_flags: ["urgency", "shortened_link", "upi_pin_request", "fake_verification_amount"],
      safe_to_proceed: false,
      suggested_ui: {
        primary_button: "Block & Ignore",
        secondary_button: "Report Scam",
      },
    },
  },
  caution: {
    id: "caution",
    label: "Emergency UPI request",
    text: "Bhai emergency hai, phone chori ho gaya. Is naye number se baat kar raha hoon. Turant 5000 is UPI pe bhej do: emergency.help@oksbi",
    response: {
      risk: "Caution",
      score: 64,
      reasons: [
        "Urgent money request from a new/unknown UPI handle",
        "Story involves lost phone — common social-engineering pattern",
        "No independent verification yet (call known number / family confirmation)",
      ],
      recommended_action:
        "Call the person on their previously saved number (not this new chat). Confirm identity before paying.",
      hindi_summary:
        "Emergency wali baat ho sakti hai, lekin pehle verify karo. Purane number pe call karke confirm kiye bina 5000 mat bhejo.",
      red_flags: ["urgency", "new_upi_id", "identity_not_verified"],
      safe_to_proceed: false,
      suggested_ui: {
        primary_button: "Verify First",
        secondary_button: "Continue Anyway",
      },
    },
  },
  safe: {
    id: "safe",
    label: "Electricity bill",
    text: "Electricity bill due: ₹842 for consumer no. thr-22019. Pay via official biller 'State Electricity Board' in Paytm. Due date 5 Oct.",
    response: {
      risk: "Safe",
      score: 18,
      reasons: [
        "Looks like a normal utility bill payment request",
        "Mentions official biller flow instead of random personal UPI",
        "No PIN, KYC link, or urgency scam language detected",
      ],
      recommended_action:
        "Pay only through Paytm official biller section. Confirm consumer number and amount before paying.",
      hindi_summary:
        "Ye normal bill payment lagta hai. Official biller se pay karo, amount aur consumer number ek baar check kar lena.",
      red_flags: [],
      safe_to_proceed: true,
      suggested_ui: {
        primary_button: "Continue to Pay",
        secondary_button: "Ask Shield",
      },
    },
  },
};

export function pickMockByText(text = "") {
  const t = text.toLowerCase();
  if (t.includes("kyc") || t.includes("bit.ly") || t.includes("upi pin")) {
    return SCENARIOS.highRisk.response;
  }
  if (t.includes("emergency") && (t.includes("@") || t.includes("upi"))) {
    return SCENARIOS.caution.response;
  }
  if (t.includes("electricity") || t.includes("biller")) {
    return SCENARIOS.safe.response;
  }
  return {
    risk: "Caution",
    score: 50,
    reasons: [
      "Not enough clear payment context",
      "Could not confidently classify as safe or scam",
      "Need full SMS/chat text for better check",
    ],
    recommended_action: "Paste the full message including any link or UPI ID.",
    hindi_summary: "Thoda aur detail bhejo — poora message, UPI ID ya link ke saath.",
    red_flags: ["incomplete_input"],
    safe_to_proceed: false,
    suggested_ui: {
      primary_button: "Verify First",
      secondary_button: "Edit Text",
    },
  };
}
