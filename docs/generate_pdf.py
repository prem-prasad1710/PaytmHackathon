"""Generate Paytm Scam Shield Hackathon Guide PDF."""
from pathlib import Path
from fpdf import FPDF

OUT = Path(__file__).parent / "Paytm_Scam_Shield_Hackathon_Guide.pdf"


class GuidePDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(80, 80, 80)
        self.cell(0, 8, "Paytm Scam Shield + Grok Bot | Hackathon Build Guide", align="L")
        self.ln(4)
        self.set_draw_color(0, 186, 242)
        self.set_line_width(0.4)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}  |  Ready-to-build reference for demo app", align="C")

    def _reset_x(self):
        self.set_x(self.l_margin)

    def h1(self, text):
        self._reset_x()
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(0, 112, 186)
        self.multi_cell(0, 10, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def h2(self, text):
        self.ln(2)
        self._reset_x()
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(0, 80, 140)
        self.multi_cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def h3(self, text):
        self.ln(1)
        self._reset_x()
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body(self, text):
        self._reset_x()
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def bullet(self, text):
        self._reset_x()
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, f"  - {text}", new_x="LMARGIN", new_y="NEXT")

    def numbered(self, n, text):
        self._reset_x()
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, f"  {n}. {text}", new_x="LMARGIN", new_y="NEXT")

    def code_block(self, text):
        self._reset_x()
        self.set_fill_color(245, 247, 250)
        self.set_draw_color(210, 215, 220)
        self.set_font("Courier", "", 8)
        self.set_text_color(20, 20, 20)
        x = self.l_margin
        w = self.epw
        lines = text.split("\n")
        line_h = 4.2
        for line in lines:
            if self.get_y() + line_h + 4 > self.page_break_trigger:
                self.add_page()
                self._reset_x()
            # draw a light background line-by-line for simplicity
            y = self.get_y()
            self.set_fill_color(245, 247, 250)
            self.rect(x, y, w, line_h, style="F")
            self.set_xy(x + 2, y)
            # Strip non-latin1 chars for core fonts
            safe = line.encode("latin-1", "replace").decode("latin-1")
            self.cell(w - 4, line_h, safe[:110])
            self.ln(line_h)
        self.ln(4)
        self._reset_x()

    def callout(self, title, text):
        self._reset_x()
        self.set_fill_color(230, 246, 255)
        self.set_draw_color(0, 186, 242)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(0, 90, 150)
        self.multi_cell(
            0,
            5.5,
            f"{title}\n{text}",
            fill=True,
            border=True,
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.ln(2)

    def table_row(self, cols, widths, header=False):
        self._reset_x()
        self.set_font("Helvetica", "B" if header else "", 9)
        if header:
            self.set_fill_color(0, 112, 186)
            self.set_text_color(255, 255, 255)
        else:
            self.set_fill_color(248, 250, 252)
            self.set_text_color(30, 30, 30)
        h = 7
        for i, c in enumerate(cols):
            safe = str(c).encode("latin-1", "replace").decode("latin-1")
            self.cell(widths[i], h, safe[: int(widths[i] / 1.7)], border=1, fill=True)
        self.ln(h)
        self._reset_x()


def build():
    pdf = GuidePDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    # COVER
    pdf.set_y(50)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(0, 112, 186)
    pdf.cell(0, 12, "Paytm Scam Shield", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(40, 40, 40)
    pdf.cell(0, 10, "+ Smart Pay Assistant (Grok Bot)", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 7, "Complete Hackathon Build Guide", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0,
        7,
        "Idea | Prompts | API Samples | React Structure | Demo Script",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(10)
    pdf.set_draw_color(0, 186, 242)
    pdf.set_line_width(1)
    pdf.line(60, pdf.get_y(), 150, pdf.get_y())
    pdf.ln(12)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(
        0,
        7,
        "Goal: Use this document as a single reference to build a ready-to-demo "
        "application for a hackathon - quickly, clearly, and impressively.",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(16)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(0, 112, 186)
    pdf.cell(0, 7, "One-liner", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "I", 11)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(
        0,
        7,
        '"Suspicious UPI / payment message ko Grok se check karo - '
        'risk score, reason, aur safe next step, Hinglish me."',
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(20)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, "Version 1.0  |  Hackathon Ready Pack", align="C", new_x="LMARGIN", new_y="NEXT")

    # TOC
    pdf.add_page()
    pdf.h1("Table of Contents")
    toc = [
        "1. Product Overview",
        "2. Problem & Why Paytm",
        "3. Features (MVP + Stretch)",
        "4. User Flow",
        "5. Tech Stack",
        "6. Project File Structure",
        "7. Grok System Prompt (Copy-Paste)",
        "8. User Message Template",
        "9. Fake Analyze API Samples (3 Scenarios)",
        "10. Backend API Spec",
        "11. Frontend Component Guide",
        "12. Starter Code Snippets",
        "13. Build Timeline (Hackathon Day)",
        "14. 3-Minute Demo Script",
        "15. Pitch Slides Outline",
        "16. Team Split",
        "17. Checklist - Demo Ready",
        "18. Stretch Ideas & Closing Pitch",
    ]
    for t in toc:
        pdf.bullet(t)

    # 1
    pdf.add_page()
    pdf.h1("1. Product Overview")
    pdf.body(
        "Paytm Scam Shield is an AI safety assistant powered by Grok. Before a user "
        "pays via UPI or follows a payment-related SMS/chat, the app analyzes the text "
        "and returns: risk level (Safe / Caution / High Risk), score (0-100), short "
        "reasons, recommended action, and a Hinglish summary."
    )
    pdf.body(
        "This is perfect for a hackathon because: (1) India UPI scam problem is real, "
        "(2) Grok reasoning is visible and impressive, (3) UI can be mocked without "
        "real bank/UPI settlement, (4) demo is live and interactive in under 3 minutes."
    )
    pdf.callout(
        "Important:",
        "Do NOT process real money in the hackathon demo. Use mock pay screens only. "
        "Always label the product as advisory / educational for safety.",
    )

    # 2
    pdf.h1("2. Problem & Why Paytm")
    pdf.h3("Problem")
    for b in [
        "UPI fraud and social engineering are rising (fake KYC, urgency, phishing links).",
        "Users often pay under pressure without a second check.",
        "Support FAQs alone are not enough at the moment of payment.",
        "Hinglish users need simple, calm guidance - not long English policies.",
    ]:
        pdf.bullet(b)
    pdf.h3("Why this fits Paytm")
    for b in [
        "Paytm is trusted for payments - adding a safety layer strengthens trust.",
        "Natural place in the pay flow: Check -> Score -> Act -> Pay (if safe).",
        "Can later connect to SMS, chat, QR, and merchant flows.",
        "Differentiates Paytm as 'smart + safe', not only 'fast pay'.",
    ]:
        pdf.bullet(b)

    # 3
    pdf.h1("3. Features (MVP + Stretch)")
    pdf.h3("Must-have (MVP)")
    for i, b in enumerate(
        [
            "Chat / paste UI for SMS, UPI request, or chat text",
            "Risk score: Safe / Caution / High Risk",
            "3 short reasons + recommended action",
            "Hinglish summary for the user",
            "Mock Confirm Pay screen (only when Safe)",
            "3 sample scenario buttons for live demo",
        ],
        1,
    ):
        pdf.numbered(i, b)
    pdf.h3("Nice-to-have (if time left)")
    for b in [
        "Voice input (Hinglish transcript -> analyze)",
        "Split-bill suggestion from bill text",
        "Smart Spend tip on fake transaction history",
        "Report scam button (stores local log)",
    ]:
        pdf.bullet(b)
    pdf.h3("Out of scope")
    for b in [
        "Real UPI settlement / bank APIs",
        "Full KYC flows",
        "Production auth / payments compliance",
    ]:
        pdf.bullet(b)

    # 4
    pdf.h1("4. User Flow")
    pdf.code_block(
        "Home\n"
        "  -> CTA: Check before you pay\n"
        "Analyze Screen\n"
        "  -> Paste SMS / UPI text  OR  click Sample Scenario\n"
        "  -> Loading: Grok check kar raha hai...\n"
        "  -> Risk Card (score + reasons + hindi_summary)\n"
        "  -> Actions:\n"
        "       High Risk / Caution -> Block / Verify First\n"
        "       Safe -> Continue to Pay (MockPay success screen)"
    )
    pdf.h3("Demo sample inputs")
    pdf.bullet("High Risk: Fake KYC link + UPI PIN ask + bit.ly link")
    pdf.bullet("Caution: Relative emergency + new UPI ID + urgency")
    pdf.bullet("Safe: Official electricity biller + amount + due date")

    # 5
    pdf.h1("5. Tech Stack")
    widths = [45, 145]
    pdf.table_row(["Layer", "Recommended choice"], widths, header=True)
    rows = [
        ("Frontend", "React + Vite (or Next.js)"),
        ("Styling", "Plain CSS / Tailwind (Paytm-like blue)"),
        ("AI", "Grok API (xAI)"),
        ("Backend", "Node Express OR Vite proxy + serverless function"),
        ("Storage", "None required; local JSON mocks are enough"),
        ("Fallback", "Hardcoded mockResponses if API key/network fails"),
    ]
    for a, b in rows:
        pdf.table_row([a, b], widths)

    pdf.ln(4)
    pdf.body("Environment variable: GROK_API_KEY=your_key_here (never commit real keys).")

    # 6
    pdf.add_page()
    pdf.h1("6. Project File Structure")
    pdf.code_block(
        "paytm-scam-shield/\n"
        "  package.json\n"
        "  .env.example                 # GROK_API_KEY=\n"
        "  public/\n"
        "  src/\n"
        "    main.jsx\n"
        "    App.jsx\n"
        "    index.css\n"
        "    pages/\n"
        "      Home.jsx\n"
        "      Analyze.jsx\n"
        "      MockPay.jsx\n"
        "    components/\n"
        "      Navbar.jsx\n"
        "      ChatInput.jsx\n"
        "      RiskCard.jsx\n"
        "      ReasonList.jsx\n"
        "      ActionButtons.jsx\n"
        "      SampleScenarios.jsx\n"
        "    services/\n"
        "      analyzeApi.js\n"
        "      mockResponses.js\n"
        "    utils/\n"
        "      riskStyles.js\n"
        "  server/   (optional)\n"
        "    index.js\n"
        "    routes/analyze.js\n"
        "    prompts/scamShield.js"
    )

    # 7
    pdf.h1("7. Grok System Prompt (Copy-Paste)")
    pdf.body("Save this exactly in server/prompts/scamShield.js or send as system role message.")
    pdf.code_block(
        "You are \"Paytm Scam Shield\", a safety assistant for UPI and digital\n"
        "payments in India.\n"
        "\n"
        "Your job:\n"
        "- Analyze user-provided payment text (SMS, chat, UPI request, link,\n"
        "  voice transcript).\n"
        "- Detect scam patterns: fake KYC, urgency, unknown UPI collect\n"
        "  requests, phishing links, lottery/refund fraud, impersonation\n"
        "  (bank/Paytm/police), prepaid verification of Rs 1/Rs 2, QR traps.\n"
        "- Be practical, calm, and clear. Prefer Hinglish for user-facing\n"
        "  summaries.\n"
        "- NEVER encourage sending money to risky parties.\n"
        "- Do NOT invent bank policies. If unsure, mark Caution and ask for\n"
        "  more details.\n"
        "- This is advisory only; final payment decision is user's.\n"
        "\n"
        "Output STRICTLY valid JSON only (no markdown, no extra text):\n"
        "{\n"
        '  "risk": "Safe" | "Caution" | "High Risk",\n'
        '  "score": 0-100,\n'
        '  "reasons": ["short reason 1", "short reason 2", "short reason 3"],\n'
        '  "recommended_action": "one clear next step",\n'
        '  "hindi_summary": "2-3 short Hinglish/Hindi lines for the user",\n'
        '  "red_flags": ["flag1", "flag2"],\n'
        '  "safe_to_proceed": true | false,\n'
        '  "suggested_ui": {\n'
        '    "primary_button": "Block / Verify / Continue to Pay",\n'
        '    "secondary_button": "Ask more / Report"\n'
        "  }\n"
        "}\n"
        "\n"
        "Scoring guide:\n"
        "- 0-30 Safe\n"
        "- 31-69 Caution\n"
        "- 70-100 High Risk\n"
        "\n"
        "If input is incomplete, still return JSON with Caution and ask what\n"
        "is missing inside hindi_summary."
    )

    # 8
    pdf.h1("8. User Message Template")
    pdf.code_block(
        "Analyze this payment-related text for scam risk.\n"
        "\n"
        "Text:\n"
        '"""\n'
        "{{USER_INPUT}}\n"
        '"""\n'
        "\n"
        "Context (optional):\n"
        "- App: Paytm-like demo\n"
        "- Locale: India\n"
        "- Language preference: Hinglish"
    )

    # 9
    pdf.add_page()
    pdf.h1("9. Fake Analyze API Samples (3 Scenarios)")
    pdf.body(
        "Use these for offline demo and as fallback when Grok API is unavailable. "
        "Keep response shape identical to live Grok output."
    )

    pdf.h3("Scenario A - High Risk (fake KYC link)")
    pdf.body("Request text:")
    pdf.code_block(
        "Aapka Paytm KYC pending hai. 24 ghante me band ho jayega. Is link pe\n"
        "Rs 1 verify kare: https://bit.ly/paytm-kyc-verify aur UPI PIN dale."
    )
    pdf.body("Response JSON:")
    pdf.code_block(
        "{\n"
        '  "risk": "High Risk",\n'
        '  "score": 92,\n'
        '  "reasons": [\n'
        '    "Urgent KYC threat + short link is a common scam pattern",\n'
        '    "Asks for UPI PIN on an external link",\n'
        '    "Rs 1 verification is often used to steal account access"\n'
        "  ],\n"
        '  "recommended_action": "Do not click the link. Do not enter UPI PIN.\n'
        ' Open official Paytm app only.",\n'
        '  "hindi_summary": "Ye message scam lag raha hai. Link mat kholo aur\n'
        ' UPI PIN kahin mat dalo.",\n'
        '  "red_flags": ["urgency", "shortened_link", "upi_pin_request"],\n'
        '  "safe_to_proceed": false,\n'
        '  "suggested_ui": {\n'
        '    "primary_button": "Block & Ignore",\n'
        '    "secondary_button": "Report Scam"\n'
        "  }\n"
        "}"
    )

    pdf.h3("Scenario B - Caution (relative emergency)")
    pdf.body("Request text:")
    pdf.code_block(
        "Bhai emergency hai, phone chori ho gaya. Is naye number se baat kar\n"
        "raha hoon. Turant 5000 is UPI pe bhej do: emergency.help@oksbi"
    )
    pdf.body("Response JSON:")
    pdf.code_block(
        "{\n"
        '  "risk": "Caution",\n'
        '  "score": 64,\n'
        '  "reasons": [\n'
        '    "Urgent money request from a new/unknown UPI handle",\n'
        '    "Lost phone story is a common social-engineering pattern",\n'
        '    "No independent verification yet"\n'
        "  ],\n"
        '  "recommended_action": "Call on previously saved number. Confirm\n'
        ' identity before paying.",\n'
        '  "hindi_summary": "Pehle verify karo. Purane number pe call karke\n'
        ' confirm kiye bina 5000 mat bhejo.",\n'
        '  "red_flags": ["urgency", "new_upi_id", "identity_not_verified"],\n'
        '  "safe_to_proceed": false,\n'
        '  "suggested_ui": {\n'
        '    "primary_button": "Verify First",\n'
        '    "secondary_button": "Continue Anyway"\n'
        "  }\n"
        "}"
    )

    pdf.add_page()
    pdf.h3("Scenario C - Safe (electricity bill)")
    pdf.body("Request text:")
    pdf.code_block(
        "Electricity bill due: Rs 842 for consumer no. thr-22019. Pay via\n"
        "official biller 'State Electricity Board' in Paytm. Due date 5 Oct."
    )
    pdf.body("Response JSON:")
    pdf.code_block(
        "{\n"
        '  "risk": "Safe",\n'
        '  "score": 18,\n'
        '  "reasons": [\n'
        '    "Looks like a normal utility bill payment request",\n'
        '    "Mentions official biller flow instead of personal UPI",\n'
        '    "No PIN, KYC link, or urgency scam language detected"\n'
        "  ],\n"
        '  "recommended_action": "Pay only through official biller. Confirm\n'
        ' consumer number and amount.",\n'
        '  "hindi_summary": "Ye normal bill payment lagta hai. Official biller\n'
        ' se pay karo, amount aur consumer number check kar lena.",\n'
        '  "red_flags": [],\n'
        '  "safe_to_proceed": true,\n'
        '  "suggested_ui": {\n'
        '    "primary_button": "Continue to Pay",\n'
        '    "secondary_button": "Ask Shield"\n'
        "  }\n"
        "}"
    )

    # 10
    pdf.h1("10. Backend API Spec")
    pdf.h3("Endpoint")
    pdf.code_block("POST /api/analyze\nContent-Type: application/json\n\n{ \"text\": \"paste message here\" }")
    pdf.h3("Success response")
    pdf.body("Same JSON schema as Section 7/9 (risk, score, reasons, recommended_action, hindi_summary, red_flags, safe_to_proceed, suggested_ui).")
    pdf.h3("Logic")
    for i, b in enumerate(
        [
            "Validate text is non-empty (else 400).",
            "Call Grok with system prompt + user template.",
            "Parse model output as JSON (strip markdown fences if model adds them).",
            "On parse/network failure: keyword match to mock scenario OR return Caution fallback.",
            "Never return free-form prose from API - always JSON.",
        ],
        1,
    ):
        pdf.numbered(i, b)

    pdf.h3("Simple keyword fallback (offline demo)")
    pdf.bullet("If text contains 'KYC' or 'bit.ly' or 'UPI PIN' -> High Risk mock")
    pdf.bullet("If text contains 'emergency' and '@' -> Caution mock")
    pdf.bullet("If text contains 'electricity' or 'biller' -> Safe mock")
    pdf.bullet("Else -> Caution fallback asking for more detail")

    # 11
    pdf.add_page()
    pdf.h1("11. Frontend Component Guide")
    widths = [50, 140]
    pdf.table_row(["File", "Responsibility"], widths, header=True)
    comps = [
        ("Home.jsx", "Problem statement + Start Check CTA"),
        ("Analyze.jsx", "Input -> API -> RiskCard + actions"),
        ("ChatInput.jsx", "Textarea + Analyze button"),
        ("SampleScenarios.jsx", "1-click fill for 3 demos"),
        ("RiskCard.jsx", "Score, risk color, hindi_summary"),
        ("ReasonList.jsx", "Bullet reasons + red flags"),
        ("ActionButtons.jsx", "Primary/secondary from suggested_ui"),
        ("MockPay.jsx", "Fake success only when Safe"),
        ("analyzeApi.js", "fetch /api/analyze + error handling"),
        ("mockResponses.js", "3 scenario JSON objects"),
        ("riskStyles.js", "green / amber / red mapping"),
    ]
    for a, b in comps:
        pdf.table_row([a, b], widths)

    pdf.ln(4)
    pdf.h3("UI states")
    pdf.bullet("Empty - show samples and placeholder")
    pdf.bullet("Loading - 'Grok check kar raha hai...'")
    pdf.bullet("Result - colored RiskCard")
    pdf.bullet("Error - toast + auto fallback to mock")

    pdf.h3("Risk colors")
    pdf.bullet("Safe: green (#16a34a)")
    pdf.bullet("Caution: amber (#d97706)")
    pdf.bullet("High Risk: red (#dc2626)")
    pdf.bullet("Brand accent: Paytm-like blue (#00baf2 / #002970)")

    # 12
    pdf.h1("12. Starter Code Snippets")
    pdf.h3("mockResponses.js (core)")
    pdf.code_block(
        "export const SCENARIOS = {\n"
        "  highRisk: { id: 'highRisk', label: 'Fake KYC SMS',\n"
        "    text: 'Aapka Paytm KYC pending hai...',\n"
        "    response: { risk: 'High Risk', score: 92, /* ... */ } },\n"
        "  caution: { id: 'caution', label: 'Emergency UPI request',\n"
        "    text: 'Bhai emergency hai...',\n"
        "    response: { risk: 'Caution', score: 64, /* ... */ } },\n"
        "  safe: { id: 'safe', label: 'Electricity bill',\n"
        "    text: 'Electricity bill due: Rs 842...',\n"
        "    response: { risk: 'Safe', score: 18, /* ... */ } },\n"
        "};\n"
        "\n"
        "export function pickMockByText(text = '') {\n"
        "  const t = text.toLowerCase();\n"
        "  if (t.includes('kyc') || t.includes('bit.ly'))\n"
        "    return SCENARIOS.highRisk.response;\n"
        "  if (t.includes('emergency')) return SCENARIOS.caution.response;\n"
        "  if (t.includes('electricity') || t.includes('biller'))\n"
        "    return SCENARIOS.safe.response;\n"
        "  return { risk: 'Caution', score: 50, reasons: ['Need more context'],\n"
        "    recommended_action: 'Share full message', hindi_summary:\n"
        "    'Thoda aur detail bhejo.', red_flags: [], safe_to_proceed: false,\n"
        "    suggested_ui: { primary_button: 'Verify First',\n"
        "      secondary_button: 'Edit Text' } };\n"
        "}"
    )

    pdf.h3("analyzeApi.js")
    pdf.code_block(
        "import { pickMockByText } from './mockResponses';\n"
        "\n"
        "export async function analyzeText(text, { useMock = false } = {}) {\n"
        "  if (!text?.trim()) throw new Error('Please paste a message');\n"
        "  if (useMock) return pickMockByText(text);\n"
        "  try {\n"
        "    const res = await fetch('/api/analyze', {\n"
        "      method: 'POST',\n"
        "      headers: { 'Content-Type': 'application/json' },\n"
        "      body: JSON.stringify({ text }),\n"
        "    });\n"
        "    if (!res.ok) throw new Error('API failed');\n"
        "    return await res.json();\n"
        "  } catch (e) {\n"
        "    console.warn('Falling back to mock', e);\n"
        "    return pickMockByText(text);\n"
        "  }\n"
        "}"
    )

    pdf.add_page()
    pdf.h3("Analyze.jsx flow (pseudo)")
    pdf.code_block(
        "1. const [text, setText] = useState('')\n"
        "2. const [result, setResult] = useState(null)\n"
        "3. const [loading, setLoading] = useState(false)\n"
        "4. onAnalyze:\n"
        "     setLoading(true)\n"
        "     result = await analyzeText(text)\n"
        "     setResult(result); setLoading(false)\n"
        "5. Render ChatInput + SampleScenarios + RiskCard\n"
        "6. If result.safe_to_proceed && Continue clicked\n"
        "     -> navigate('/mock-pay')"
    )

    pdf.h3("Grok API call sketch (server)")
    pdf.code_block(
        "// pseudo - adapt to current xAI Grok HTTP API\n"
        "POST https://api.x.ai/v1/chat/completions\n"
        "Authorization: Bearer GROK_API_KEY\n"
        "{\n"
        '  "model": "grok-2-latest",\n'
        '  "temperature": 0.2,\n'
        '  "messages": [\n'
        '    { "role": "system", "content": SYSTEM_PROMPT },\n'
        '    { "role": "user", "content": userTemplate(text) }\n'
        "  ]\n"
        "}\n"
        "// Then JSON.parse(content) after cleaning ```json fences"
    )

    # 13
    pdf.h1("13. Build Timeline (Hackathon Day)")
    widths = [35, 155]
    pdf.table_row(["Time", "Task"], widths, header=True)
    for a, b in [
        ("0-1 hr", "Scaffold React app, theme, Home + Navbar"),
        ("1-2 hr", "Analyze page + mocks + RiskCard working offline"),
        ("2-4 hr", "Backend /api/analyze + Grok prompt integration"),
        ("4-5 hr", "MockPay, sample buttons, polish colors/copy"),
        ("5-6 hr", "Error fallback, demo rehearsal (3 scenarios)"),
        ("Last hr", "Pitch deck + 3-min script practice"),
    ]:
        pdf.table_row([a, b], widths)

    # 14
    pdf.ln(4)
    pdf.h1("14. 3-Minute Demo Script")
    widths = [30, 160]
    pdf.table_row(["Time", "Say / Show"], widths, header=True)
    for a, b in [
        ("0:00-0:20", "Problem: UPI scams rising; people pay in panic"),
        ("0:20-0:50", "Solution: Check before pay with Grok - Hinglish"),
        ("0:50-1:40", "LIVE: paste fake KYC SMS -> High Risk card"),
        ("1:40-2:20", "LIVE: electricity bill -> Safe -> Mock Pay"),
        ("2:20-2:45", "Impact: fewer frauds, more trust for Paytm"),
        ("2:45-3:00", "Next: voice, SMS auto-detect, family alerts"),
    ]:
        pdf.table_row([a, b], widths)
    pdf.ln(3)
    pdf.callout(
        "Closing line:",
        "Paytm pe payment se pehle ek smart second - Scam Shield by Grok.",
    )

    # 15
    pdf.h1("15. Pitch Slides Outline")
    for i, b in enumerate(
        [
            "Title - Paytm Scam Shield + Grok",
            "Problem - UPI fraud, fake KYC, urgency scams",
            "Solution - Check -> Score -> Act",
            "Live demo / screenshots",
            "How it works - User -> App -> Grok -> Risk card",
            "Why Paytm - trust, payments graph, Hinglish users",
            "Roadmap - SMS auto-detect, voice, family alerts",
        ],
        1,
    ):
        pdf.numbered(i, b)

    # 16
    pdf.add_page()
    pdf.h1("16. Team Split (4 people)")
    widths = [30, 160]
    pdf.table_row(["Who", "Owns"], widths, header=True)
    for a, b in [
        ("A", "UI: Home, Analyze, RiskCard, MockPay"),
        ("B", "API: /analyze + Grok integration + fallback"),
        ("C", "Prompt tuning + 3 demo scenarios + edge cases"),
        ("D", "Pitch deck + demo script + fake data QA"),
    ]:
        pdf.table_row([a, b], widths)

    # 17
    pdf.ln(4)
    pdf.h1("17. Checklist - Demo Ready")
    for b in [
        "[ ] App opens on laptop without errors",
        "[ ] Sample High Risk scenario works offline",
        "[ ] Sample Caution scenario works",
        "[ ] Sample Safe scenario -> MockPay success",
        "[ ] Loading state visible",
        "[ ] API failure falls back to mocks (no blank screen)",
        "[ ] Hinglish summary readable on RiskCard",
        "[ ] Brand colors look Paytm-like (blue theme)",
        "[ ] No real API keys shown on screen/slides",
        "[ ] 3-minute script rehearsed twice",
        "[ ] Backup: screenshots/GIF if live Wi-Fi fails",
    ]:
        pdf.bullet(b)

    # 18
    pdf.h1("18. Stretch Ideas & Closing Pitch")
    pdf.h3("Stretch")
    pdf.bullet("Voice: '500 bhejna hai Rahul ko - pehle check karo'")
    pdf.bullet("Smart Spend Coach tab on fake transactions")
    pdf.bullet("Family Money Mode - limits + simple summary")
    pdf.bullet("Merchant helper for kirana QR explainers")

    pdf.h3("Judges - 3 impress points")
    pdf.numbered(1, "Real India problem (UPI scams)")
    pdf.numbered(2, "Clear AI use (Grok reasoning + Hinglish)")
    pdf.numbered(3, "Paytm product fit (safety before payment)")

    pdf.ln(6)
    pdf.callout(
        "Final note:",
        "First make the offline mock demo flawless. Then connect Grok. "
        "A beautiful fallback demo beats a broken live API call.",
    )

    pdf.ln(10)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(0, 112, 186)
    pdf.multi_cell(0, 8, "End of Guide - Go build. All the best for the hackathon!", align="C")

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
