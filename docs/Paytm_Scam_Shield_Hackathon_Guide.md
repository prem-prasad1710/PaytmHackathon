# Paytm Scam Shield + Smart Pay Assistant (Grok Bot)
## Complete Hackathon Build Guide (Markdown twin of the PDF)

> Use this file for easy copy-paste. Use the PDF for reading/sharing.

---

## One-liner
Suspicious UPI / payment message ko Grok se check karo — risk score, reason, aur safe next step, Hinglish me.

---

## 1. Product Overview
AI safety assistant powered by Grok. Before pay, analyze SMS/chat/UPI text → Safe / Caution / High Risk + score + reasons + Hinglish summary + action buttons. Mock pay only (no real money).

## 2. Problem & Why Paytm
- UPI scams / fake KYC / urgency fraud rising
- Users pay under pressure
- Paytm fit: trust + pay flow + Hinglish users

## 3. MVP Features
1. Paste UI
2. Risk score
3. Reasons + action
4. Hinglish summary
5. Mock Pay (Safe only)
6. 3 sample scenario buttons

## 4. User Flow
Home → Check before you pay → Analyze → Risk Card → Block/Verify OR Continue to MockPay

## 5. Tech Stack
React + Vite, Grok API, Node/Express optional, mockResponses fallback, `GROK_API_KEY`

## 6. File Structure
See PDF section 6 / README starter folder.

## 7. Grok System Prompt (copy-paste)

```text
You are "Paytm Scam Shield", a safety assistant for UPI and digital payments in India.

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

If input is incomplete, still return JSON with Caution and ask what is missing inside hindi_summary.
```

## 8. User Message Template

```text
Analyze this payment-related text for scam risk.

Text:
"""
{{USER_INPUT}}
"""

Context (optional):
- App: Paytm-like demo
- Locale: India
- Language preference: Hinglish
```

## 9. Three API Samples
Full JSON lives in `starter/mockResponses.js` (High Risk / Caution / Safe).

## 10–18
API spec, components, snippets, timeline, demo script, slides, team split, checklist — see PDF.

## Closing line
Paytm pe payment se pehle ek smart second — Scam Shield by Grok.
