# Paytm Scam Shield — Phase 2 features (for judges)

Built 2026-10-06 on top of the hybrid **ML + Graph + Rules** engine. These features are designed so the demo does **not** feel like a generic fraud classifier: it narrates the scam, names the playbook stage, explains in Hinglish, and can run with **no Grok key**.

## How to run the demo

```bash
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
cd /Users/premprasad/Downloads/Paytm-Scam-Shield-Hackathon
npm run setup:js          # if needed
npm run dev:lite          # API :8787 + web :5173 (ML optional)
# optional full: npm run dev
```

Open **http://127.0.0.1:5173/demo** or click **▶ Judge demo** on Home / Navbar **Demo**.

---

## 1. Live judge demo mode

**What:** One-click scripted story — digital arrest call → AnyDesk → ₹1 KYC collect → BLOCK → Guardian. Pause / Next / Reset. **Works fully offline** (no API, no Grok).

**Where:** `/demo` or Fraud Lab → “Start judge demo”. Navbar **Demo**.

**Files:** `shared/judgeScript.js`, `web/src/components/fraud/JudgeDemo.jsx`, `web/src/pages/FraudLab.jsx`

**Commit:** `af26e31`

---

## 2. Scammer's playbook timeline

**What:** Six India UPI scripts (fake KYC / wrong-transfer refund / collect-as-receive / job-task / digital arrest / OLX QR). Detects stage and shows “you are at stage X of 5 — next they will ask Y”.

**Where:** Analyze result card after pasting a KYC / coaching message; Fraud Lab decision card; judge demo step 3.

**Files:** `shared/playbook.js`, `shared/offlineEngine.js` (`finalizeAnalysis`), `server/fraud/explainer.js`, `web/src/components/fraud/PlaybookTimeline.jsx`

**Commit:** `c7c3348` (+ UI in `b15698f`)

---

## 3. Dual plain-language explanations

**What:** Side-by-side **For you (Hinglish)** and **Analyst / bank view** (signals, weights, rule IDs, model score). Deterministic templates. If Grok is configured later it may **only rephrase** user text — never change the verdict.

**Where:** Analyze (`DualExplain` under RiskCard); Fraud Lab DecisionCard “Why?” area.

**Files:** `shared/dualExplain.js`, `web/src/components/DualExplain.jsx`, `server/hybrid.js`, `server/fraud/explainer.js`

**Commit:** `0ca9bcc`

---

## 4. First-time payee time-lock

**What:** Longer visible cooling-off (up to 45s) when the payee is new and risk is elevated/high, or large first payment (≥ ₹5000). Shows reasons; Confirm enabled only after countdown + acknowledgement.

**Where:** Check a High Risk message → Continue/Confirm path → **Confirm Pay**.

**Files:** `web/src/pages/ConfirmPay.jsx` (extends prior `COOLDOWN` / first-payee spirit of `LARGE_FIRST_PAYMENT`)

**Commit:** `021b4c2`

---

## 5. Pre-payment coercion / intent flags

**What:** Detects “stay on the call”, “mat batana”, AnyDesk/TeamViewer/QuickSupport, police/CBI/RBI/customs, OTP/PIN asks (EN + Hinglish). Boosts score; Guardian title becomes **“Someone may be coaching you.”**

**Where:** Analyze any coaching SMS → High Risk overlay; also chips on RiskCard.

**Files:** `shared/coercion.js`, `shared/offlineEngine.js`, `web/src/components/GuardianOverlay.jsx`

**Commits:** `c7c3348` (engine), `b15698f` (UI)

---

## 6. Honest offline / live status badge

**What:** Clear provenance: **Full stack** (server + ML), **Server only**, **On-device offline**, or **Live Grok**.

**Where:** Every Analyze RiskCard; DecisionCard in Lab; judge demo header.

**Files:** `web/src/components/StatusBadge.jsx`, `web/src/services/analyzeApi.js`, `web/src/components/RiskCard.jsx`

**Commit:** `b15698f`

---

## Regression demos (must still work)

| Sample chip | Expected |
|-------------|----------|
| Electricity bill | **Safe** |
| Emergency UPI | **Caution** |
| Fake KYC SMS | **High Risk** + playbook `fake_kyc` |

Covered by `server/tests/offline_features.test.js`.

---

## Local git (no remote)

```text
b15698f feat: coaching Guardian, playbook on Analyze, honest status badge
021b4c2 feat: stronger first-time payee time-lock on ConfirmPay
0ca9bcc feat: dual plain-language explanations (user + analyst)
c7c3348 feat: scammer playbook + coercion signals in offline engine
af26e31 feat: live judge demo mode (offline scripted E2E)
```
