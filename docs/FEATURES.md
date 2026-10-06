# Paytm Scam Shield — Features for judges

Built for a Paytm internal hackathon: **stops the scam conversation before money moves**, explains in the user's language, and can involve family — not a generic fraud classifier scorecard.

## Judge pitch (30 seconds)

**Problem.** UPI scams are scripts (fake KYC, digital arrest, collect-as-receive). Victims are coached on a call while they pay. A single model score arrives too late and cannot explain itself in Hinglish.

**Why this is different.** Three engines (ML + graph + rules) decide. GenAI/Groq/Grok may only rephrase. A **playbook timeline** shows which stage of a known India scam script the user is in. **Coercion flags** catch AnyDesk / "mat batana". **Family Guardian** lets Mom decline a risky pay. **Judge demo** walks the whole story offline or live.

## 3-minute demo script

1. Open **http://127.0.0.1:5173/demo** → Play judge demo (message → signals → playbook → BLOCK → coaching Guardian → Family decline → outcome).
2. **Check** → Fake KYC / Hindi digital-arrest / Tamil chips → High Risk, playbook, dual explain, safe replies + 1930 card, status badge.
3. **Lab** → Scam case → Investigate Network → red **fund-forward mule hops** with ₹ amounts.
4. **Confirm Pay** (from Caution/High path) → time-lock + optional Family approval → open **/family** and Decline.
5. Optional: stop API → Analyze still works **on-device offline**.

## Feature index

| Feature | Where | Commit hint |
|---------|-------|-------------|
| Judge demo | `/demo`, Navbar Demo | `af26e31` |
| Playbook timeline | Analyze + Lab | `c7c3348` |
| Dual explanations | Analyze + DecisionCard | `0ca9bcc` |
| First-time payee time-lock | Confirm Pay | `021b4c2` |
| Coercion / coaching | Guardian overlay | `b15698f` |
| Status badge | Analyze / Lab | `b15698f` |
| Family Guardian | `/family`, Confirm Pay | `835d5f5` |
| Money-mule graph | Lab → Investigate Network | `838b56c` |
| Regional languages | Sample chips (Hindi/Tamil/Bengali/Marathi) | `19bc89d` |
| Safe replies + 1930 | High Risk Analyze | `550df85` |
| Mobile parity | Expo Analyze / ConfirmPay | `70842c1` |
| Live stack + Groq/Grok LLM | `npm run dev:live` | (this batch) |

## Live vs offline

- **Live:** `VITE_USE_MOCK=false`, API `:8787`, ML `:8001`. Badge: **Full stack** when ML is up.
- **LLM (optional):** `GROQ_API_KEY` (preferred) or `GROK_API_KEY` in `server/.env`. Provider shown on `/api/health` → `llm`. LLM never changes the verdict.
- **Offline fallback:** stop the API → web Analyze still returns template/playbook/coercion results.

## Regression demos

| Sample | Expected |
|--------|----------|
| Electricity bill | Safe |
| Emergency UPI | Caution |
| Fake KYC SMS | High Risk + playbook `fake_kyc` |
