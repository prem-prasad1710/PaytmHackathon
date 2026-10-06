export const SYSTEM_PROMPT = `You are "Paytm Scam Shield", a safety assistant for UPI and digital payments in India.

Your job:
- Analyze user-provided payment text (SMS, chat, UPI request, link, voice transcript).
- Detect scam patterns: fake KYC, urgency, unknown UPI collect requests, phishing links, lottery/refund fraud, impersonation (bank/Paytm/police), prepaid "verification" of Rs 1/Rs 2, QR traps.
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
    "primary_button": "string",
    "secondary_button": "string"
  }
}

Button rules for suggested_ui:
- If High Risk: primary_button="Block & Ignore", secondary_button="Report Scam"
- If Caution: primary_button="Verify First", secondary_button="Continue Anyway"
- If Safe: primary_button="Continue to Pay", secondary_button="Ask Shield"

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

export function pickMockByText(text = "") {
  const t = text.toLowerCase();
  if (t.includes("kyc") || t.includes("bit.ly") || t.includes("upi pin")) {
    return normalizeResult({
      risk: "High Risk",
      score: 92,
      reasons: [
        "Urgent KYC threat + short link is a common scam pattern",
        "Asks for UPI PIN on an external link",
        "Rs 1 verification is often used to steal account access",
      ],
      recommended_action: "Do not click the link. Do not enter UPI PIN.",
      hindi_summary:
        "Ye message scam lag raha hai. Link mat kholo aur UPI PIN kahin mat dalo.",
      red_flags: ["urgency", "shortened_link", "upi_pin_request"],
      safe_to_proceed: false,
    });
  }
  if (t.includes("emergency") && (t.includes("@") || t.includes("upi"))) {
    return normalizeResult({
      risk: "Caution",
      score: 64,
      reasons: [
        "Urgent money request from a new/unknown UPI handle",
        "Lost phone story is a common social-engineering pattern",
        "No independent verification yet",
      ],
      recommended_action: "Call on previously saved number before paying.",
      hindi_summary:
        "Pehle verify karo. Purane number pe call karke confirm kiye bina mat bhejo.",
      red_flags: ["urgency", "new_upi_id", "identity_not_verified"],
      safe_to_proceed: false,
    });
  }
  if (t.includes("electricity") || t.includes("biller")) {
    return normalizeResult({
      risk: "Safe",
      score: 18,
      reasons: [
        "Looks like a normal utility bill payment request",
        "Mentions official biller flow instead of personal UPI",
        "No PIN, KYC link, or urgency scam language detected",
      ],
      recommended_action: "Pay only through official biller section.",
      hindi_summary:
        "Ye normal bill payment lagta hai. Official biller se pay karo.",
      red_flags: [],
      safe_to_proceed: true,
    });
  }
  return normalizeResult({
    risk: "Caution",
    score: 50,
    reasons: ["Not enough clear payment context", "Need full SMS/chat text"],
    recommended_action: "Paste the full message including any link or UPI ID.",
    hindi_summary: "Thoda aur detail bhejo — poora message ke saath.",
    red_flags: ["incomplete_input"],
    safe_to_proceed: false,
  });
}

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
    reasons: Array.isArray(raw.reasons) && raw.reasons.length
      ? raw.reasons.slice(0, 5).map(String)
      : ["Model response incomplete"],
    recommended_action: String(
      raw.recommended_action || "Review carefully before paying."
    ),
    hindi_summary: String(
      raw.hindi_summary || "Shield ne is message ko check kiya."
    ),
    red_flags: Array.isArray(raw.red_flags)
      ? raw.red_flags.map(String)
      : [],
    safe_to_proceed,
    suggested_ui: {
      primary_button:
        raw.suggested_ui?.primary_button || suggested_ui.primary_button,
      secondary_button:
        raw.suggested_ui?.secondary_button || suggested_ui.secondary_button,
    },
  };
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
