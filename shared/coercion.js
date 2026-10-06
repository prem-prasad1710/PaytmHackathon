/**
 * Pre-payment coercion / intent cues — English + Hinglish.
 * Pure offline detection. Raises risk and triggers Guardian "coaching" intervention.
 */

const PATTERNS = [
  {
    id: "stay_on_call",
    label: "Stay on the call",
    labelHi: "कॉल पर बने रहो",
    weight: 22,
    re: /stay on (the )?call|call pe raho|call mat kaato|don't cut (the )?call|line pe raho|phone rakhna|keep (the )?call/i,
  },
  {
    id: "secrecy",
    label: "Don't tell anyone",
    labelHi: "किसी को मत बताना",
    weight: 20,
    re: /don'?t tell (anyone|family|anyone else)|kisi ko mat batana|ghar walon? ko mat|secret rakhna|chupke|don't inform|mat batana/i,
  },
  {
    id: "screen_share",
    label: "Screen-share / remote access app",
    labelHi: "स्क्रीन शेयर ऐप",
    weight: 28,
    re: /\banydesk\b|\bteamviewer\b|\bquicksupport\b|\bultraviewer\b|\bairdroid\b|screen\s*share|remote (access|desktop)|apna screen share|screen sharing on karo/i,
  },
  {
    id: "authority_fear",
    label: "Police / CBI / RBI / customs pressure",
    labelHi: "पुलिस / CBI / RBI दबाव",
    weight: 24,
    re: /\b(cbi|rbi|ed|customs|narcotics)\b|cyber\s*cell|digital\s*arrest|police\s*(station|case|complaint)|fir\b|warrant|gili parcel|drug parcel|court notice/i,
  },
  {
    id: "otp_pin",
    label: "OTP / UPI PIN request",
    labelHi: "OTP / UPI PIN माँग",
    weight: 26,
    re: /\b(otp|upin|upi\s*pin|atm\s*pin|cvv)\b|pin batao|otp share|otp bhejo|password bata|secret code/i,
  },
  {
    id: "urgency_fear",
    label: "Urgency / fear language",
    labelHi: "जल्दी / डर",
    weight: 14,
    re: /immediately|turant|abhi nahi to|last (warning|chance)|account block|freeze|arrest|jail|giraftar|warna|within \d+\s*(min|minute|hour)/i,
  },
  {
    id: "coaching",
    label: "Someone coaching the payment",
    labelHi: "कोचिंग / निर्देश",
    weight: 18,
    re: /main bataata|main bataunga|jo bolun|follow my (instruction|steps)|step by step|mere kehne pe|do as i say|jo main bolu/i,
  },
  {
    id: "secrecy_hi",
    label: "Don't tell family (Hindi)",
    labelHi: "परिवार को मत बताना",
    weight: 20,
    re: /परिवार को मत|माता.?पिता को मत|किसी को मत बताना|गुप्त रखो|चुपके से/,
  },
  {
    id: "stay_on_call_hi",
    label: "Stay on call (Hindi)",
    labelHi: "कॉल मत काटना",
    weight: 22,
    re: /कॉल पर रहो|कॉल मत काटो|फोन मत काटना|लाइन काटना मना/,
  },
  {
    id: "otp_pin_hi",
    label: "OTP/PIN (Hindi)",
    labelHi: "ओटीपी / पिन माँग",
    weight: 26,
    re: /ओटीपी बताओ|ओटीपी भेजो|पिन बताओ|यूपीआई पिन|गुप्त कोड/,
  },
  {
    id: "screen_share_regional",
    label: "Remote app (regional)",
    labelHi: "रिमोट ऐप",
    weight: 28,
    re: /ஏனிடெஸ்க்|ఏనీడెస్క్|অ্যানিডেস্ক|अॅनीडेस्क|any\s*desk|ടീംവ്യൂവർ/i,
  },
  {
    id: "authority_ta",
    label: "Police/cyber (Tamil/Telugu/Bengali)",
    labelHi: "போலீஸ் / সাইবার",
    weight: 24,
    re: /சைபர்\s*செல்|போலీஸ்|సైబర్\s*సెల్|পুলিশ|সাইবার\s*সেল|सायबर\s*सेल|डिजिटल\s*अरेस्ट|டிஜிட்டல்\s*அரெஸ்ட்/,
  },
];

/**
 * @returns {{
 *   detected: boolean,
 *   scoreBoost: number,
 *   flags: Array<{id,label,labelHi,weight}>,
 *   coachingSuspected: boolean,
 *   interventionHi: string,
 *   interventionEn: string,
 * }}
 */
export function detectCoercion(text = "") {
  const raw = String(text || "");
  const flags = [];
  for (const p of PATTERNS) {
    if (p.re.test(raw)) {
      flags.push({ id: p.id, label: p.label, labelHi: p.labelHi, weight: p.weight });
    }
  }

  const scoreBoost = Math.min(40, flags.reduce((s, f) => s + f.weight, 0));
  const coachingSuspected = flags.some((f) =>
    ["stay_on_call", "secrecy", "screen_share", "coaching", "authority_fear",
     "secrecy_hi", "stay_on_call_hi", "screen_share_regional", "authority_ta"].includes(f.id)
  );

  return {
    detected: flags.length > 0,
    scoreBoost,
    flags,
    coachingSuspected,
    interventionEn: coachingSuspected
      ? "Someone may be coaching you on a call or via screen-share. Hang up, leave the remote session, and verify independently before any payment."
      : flags.length
        ? "Pressure or secrecy language detected. Pause and verify through an official channel."
        : "",
    interventionHi: coachingSuspected
      ? "Lagta hai koi call / screen-share pe aapko coach kar raha hai. Call kaato, remote app band karo, aur pehle khud verify karo — tabhi pay karo."
      : flags.length
        ? "Dabaav / secrecy wale words mile. Ruko, official channel se verify karo."
        : "",
  };
}

export const COERCION_PATTERNS = PATTERNS;
