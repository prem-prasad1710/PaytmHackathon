# Paytm Scam Shield

Protects people from QR, message, screenshot and payment-behaviour scams, and now scores every payment with a hybrid **ML + Graph + Rules** fraud engine.

- **Web app** (`web/`): Vite + React, including the **Fraud Lab** (`/lab`)
- **API** (`server/`): Express. Message analysis (rules / Grok / ML), community reports, and the payment fraud engine (`server/fraud/`)
- **ML service** (`ml/`): Python FastAPI. XGBoost transaction-fraud model + the scam text classifier
- **Expo mobile app** (`mobile/`) and **docs** (`docs/`)

## The story

**Problem.** Scammers do not look like fraud one payment at a time. A fake KYC desk is a 3-day-old account that suddenly receives 43 payments in 5 minutes, shares a phone with three already-blocked accounts, and has 17 victims who reported it. Static rules catch the loud cases and miss the subtle ones. A model alone is a black box that can be fooled and cannot explain itself to a bank.

**Solution.** Three independent engines look at every payment, and a risk aggregator makes the decision.

| Engine | Question it answers | Output |
|--------|--------------------|--------|
| **ML** (XGBoost, `ml/`) | "Does this payment look like the fraud we have seen before?" | fraud probability, risk score, top factors (SHAP) |
| **Graph** (`server/fraud/graphEngine.js`) | "Is the recipient connected to a larger suspicious network?" | graph risk score, connected blocked/flagged accounts, victims |
| **Rules** (`server/fraud/ruleEngine.js`) | "Does this violate a known fraud pattern?" | rule score, triggered rule ids and evidence |

```text
payment ──► ML model ──┐
        ├─► Graph ─────┼─► Risk aggregator ─► SAFE / WARNING / BLOCK ─► explanation
        └─► Rules ─────┘    (0.40 / 0.35 / 0.25, + safety overrides)
```

- **Aggregation** (`server/fraud/riskAggregator.js`): weighted score 0-100. Weights and thresholds are configurable (`RISK_ML_WEIGHT`, `RISK_GRAPH_WEIGHT`, `RISK_RULE_WEIGHT`, `RISK_WARNING_THRESHOLD`, `RISK_BLOCK_THRESHOLD`). Hard overrides: a confirmed blocked recipient is always CRITICAL; multiple confirmed scam connections plus extreme velocity is CRITICAL regardless of the model. Safety floors: when the ML service is down the strongest graph/rule evidence is kept at 85% of its value; when two engines agree (both ≥75) the score cannot fall below the lower of them; and a strong graph or rule alarm (≥60, `RISK_ALARM_MIN`) lifts the score to at least 60% of itself (`RISK_ALARM_FACTOR`) so a calm model cannot hide it, for example a large first payment to an unseen account (`LARGE_FIRST_PAYMENT` rule). For text checks, a text-model probability of 92% or more (`TEXT_ML_CONFIDENT`) keeps the verdict at High Risk even if a keyword template looked benign.
- **GenAI** never decides. The explanation shown to users is built from the engines' own evidence (`explainer.js`). An LLM may later rephrase it, but it is not in the decision path.
- **Graceful degradation.** If the Python service is down, the decision object says `mlAvailable: false`, the ML weight is dropped, and graph + rules keep protecting the payment.
- The graph engine's score is also one of the model's input features (`graph_risk_score`, `connected_blocked_accounts`, `distance_to_blocked_entity`, ...), so the ML sees network context too.

## Quick start

```bash
npm install            # root helpers (concurrently)
npm run setup          # web + server deps, creates ml/.venv, builds the dataset, trains every model
npm run dev            # ML service (:8001), API (:8787) and web (:5173) together
```

Open http://localhost:5173/lab.

**Minimal demo (no Python):** `npm run setup:js && npm run dev:lite` starts only API + web. The Fraud Lab runs on graph + rules and shows "ML service offline". `ML_MODE=mock npm run dev:lite` adds a clearly labelled heuristic mock (never presented as a trained model).

Run pieces individually: `npm run dev:ml`, `npm run dev:server`, `npm run dev:web`.

> `node_modules` is platform specific. Never copy it between Windows and macOS, run `npm run setup` instead.

### Commands

| Command | What it does |
|---------|--------------|
| `npm run dataset:ml` | regenerate the synthetic transaction dataset (>100k rows) |
| `npm run train:ml` | rebuild dataset, train XGBoost + logistic baseline, evaluate, write the registry |
| `npm run evaluate:ml` | re-run evaluation of the registered model, rewrites `ml/evaluation/metrics.json` |
| `npm run test:ml` | Python tests (dataset, leakage, features, model, API, demo scenario) |
| `npm run test:server` | Node tests (aggregation, graph, rules, ML client contract, simulator, API) |
| `npm test` | both |

Environment (see `server/fraud/config.js`): `ML_SERVICE_URL=http://localhost:8001`, `ML_SERVICE_ENABLED=true`, `ML_TIMEOUT_MS`, `ML_MODE=python|mock`, `FRAUD_SIM_SEED`.

## ML layer (`ml/`)

```text
ml/
  dataset/     simulator, generate_dataset.py, build_demo_world.py
  features/    feature_engineering.py (one shared build_transaction_features), graph.py
  training/    train_model.py, evaluate_model.py, cross_validate.py
  inference/   FastAPI service, predict.py (model loaded once), explain.py (SHAP -> text)
  models/v1/   model.json, metadata.json, metrics.json, scam_dna.json   (+ models/registry.json)
  evaluation/  metrics.json, feature_importance.json, cross_validation.json, plots
  tests/
```

- **Dataset**: event-sourced simulator (60 days, 6,000 users, 1,200 merchants) producing legitimate payments, hard negatives (flash sales, donation drives, device changes, shared devices) and six scam families: phishing/KYC, reward, investment, job, account takeover and money mule. Labels come from the generating campaign, never from features.
- **39 features**: amount, account ages, velocity (5 min / 1 h / 24 h), complaint rate, device/IP sharing, fund-movement, sender behaviour z-scores, and graph features.
- **No leakage**: features come from state strictly before each payment (the same `build_transaction_features` runs in training and in serving); the split is chronological 70/15/15; tests check prefix invariance, label-flip invariance and banned feature names.
- **Model**: XGBoost (unweighted, early stopping on PR-AUC), decision threshold chosen on the validation set, compared with a class-balanced logistic regression on the same split.
- **Reports**: precision, recall, F1, ROC-AUC, PR-AUC, confusion matrix, FPR, FNR, per-scam-type recall, reliability bins, latency, SHAP importance, time-series CV, feature-group ablation. All computed by `training/evaluate_model.py` and written to `ml/evaluation/metrics.json`; the UI reads that file. Nothing is hard-coded.
- **Serving**: `POST /predict` returns `fraudProbability`, `riskScore`, `modelVersion`, `topFactors` and `scamDna`. Also `/ingest`, `/metrics`, `/importance`, `/monitoring`, `/health`.
- **Registry**: `ml/models/v1/{model.json,metadata.json,metrics.json}`; `registry.json` points at the active version.

### Fraud Lab (web)

- **Three demo cases** (normal ≈ SAFE, suspicious ≈ WARNING, scam ≈ BLOCK). They are computed from a deterministic event ledger (`shared/fraudDemoWorld.json`); the scam recipient's profile (3 days old, 43 payments in 5 min, 17 complaints, 3 blocked connections, 8 users on one device, rapid fund movement) is derived from raw events by the same feature code as training, and then scored by the real model. Renaming the recipient does not change the result (tested).
- **Prediction card**: risk ring, three engine bars, fraud-probability bar with decision threshold, colour-coded top factors, **Why?** (evidence lines, triggered rules, applied overrides, weights).
- **Investigate Network**: SVG of the recipient, accounts sharing its device or IP, blocked accounts, and recent payers.
- **Scam DNA**: cosine similarity between the payment's feature profile and the average profile of each scam family.
- **Scam Copilot**: the existing message / QR / screenshot analyzer (`/analyze`).
- **Live simulation**: seeded stream of payments, each scored by all three engines; a blocked payment raises a **NEW THREAT DETECTED** card.
- **ML Intelligence**: model version, transactions scored, precision, recall, PR-AUC, FPR, logistic vs XGBoost, confusion matrix, SHAP importance, live monitoring (`prediction_count`, `fraud_prediction_count`, `average_risk_score`, `high_risk_rate`, model latency).

### API (`/api/fraud/*`)

`GET /overview`, `POST /evaluate` (`{transaction:{amount,senderId,recipientId,deviceId,ipAddress,timestamp?}}`), `POST /scenario/:normal|suspicious|scam`, `POST /stream/next`, `GET /network/:accountId`, `POST /reset`, `GET /health`.

Decision object:

```json
{
  "riskScore": 96, "riskLevel": "CRITICAL", "decision": "BLOCK",
  "mlAvailable": true,
  "ml":    { "score": 93, "probability": 0.93, "modelVersion": "v1.0", "topFactors": [] },
  "graph": { "score": 100, "connectedEntities": 3, "connectedVictims": 50 },
  "rules": { "score": 97, "triggeredRules": ["HIGH_VELOCITY", "HIGH_COMPLAINT_RATE"] },
  "explanation": ["Connected to 3 confirmed scam entities and 43 payments in 5 minutes"]
}
```

## Honest limits

- **The data is synthetic.** The test set is far easier than real traffic: expect PR-AUC well below the reported ~0.99 on production data, and precision that depends heavily on the real fraud rate (the UI shows a prevalence-adjusted figure). Real labels (confirmed chargebacks, reports) are needed before relying on the model.
- Time-series cross-validation shows the model needs history: the earliest fold (smallest training window) scores far below the later ones (`ml/evaluation/cross_validation.json`).
- The model can be very confident on ambiguous cases. The aggregator, not the model alone, keeps such payments at WARNING.
- Without the ML service, a suspicious-but-not-confirmed payee can fall from WARNING to SAFE. That is the value the model adds, and why the UI marks ML as unavailable.
- The graph, community map and Scam DNA reflect the simulated ledger; persistence is in memory (no database), so state resets when the API restarts.
- Advisory only. No real payments.

## What it does (existing features)

| Feature | How |
|---------|-----|
| **QR scanner** (camera or image upload) | `jsQR` decodes on-device. `web/src/utils/upiQr.js` parses `upi://pay` / `collect` payloads and flags collect-requests, authority-style payee names, unknown UPI handles, large pre-filled amounts, community-flagged IDs, and phishing / shortened / look-alike links |
| **Message check** | Rule engine (16 scenarios, Hinglish + typo tolerant) or Grok, blended with the text ML model |
| **Screenshot check** | `tesseract.js` OCR on-device, then the message pipeline plus fake "payment successful" receipt checks |
| **Explainable text ML** | Highlighted risky words, per-token weights, score breakdown, scam-type label |
| **Payment Guardian** | Isolation Forest scores amount vs your usual spend, new payee, night time, velocity, complaints, collect requests, then enforces a cooling-off timer |
| **High-risk overlay** | Full-screen stop screen with rotating reasons and the 1930 helpline |
| **Community threat map** | India tile map of reports by state, scam-type trends, most-reported senders |
| **Persistence** | Checks saved on-device, reports in `server/data/reports.json` |

The text model lives in `ml/text_model/` (`/text/predict`, `/text/transaction`, `/text/metrics`); its numbers are on the in-app **Model** page.

## Grok API (optional)

```env
# server/.env
GROK_API_KEY=xai-your-real-key
GROK_MODEL=grok-4-latest
PORT=8787
ML_SERVICE_URL=http://127.0.0.1:8001
```

## Demo script (4 minutes)

1. **Lab → Normal payment**: SAFE, 0/100, "What reassured the model".
2. **Suspicious payment**: WARNING. Note that the ML model raises it; with the ML service stopped it would stay SAFE.
3. **Scam payment**: BLOCK, CRITICAL. Click **Why?**, **Investigate Network**, **Scam DNA**.
4. **Start stream**: within ~15 s a **NEW THREAT DETECTED** card appears; watch the ML Intelligence monitoring counters move.
5. Stop the ML service and run the scam case again: still BLOCK with "ML unavailable".
6. **Scam Copilot** (Check page): QR, message and screenshot analysis.

## Mobile (Expo)

```bash
cd mobile && npm install && npm start
```

Set `EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:8787` in `mobile/.env` for a real phone. The mobile app does not include the QR, screenshot, map, guardian or Fraud Lab features.
