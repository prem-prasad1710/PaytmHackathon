"""Time-series cross-validation and feature-group ablation.

    python ml/training/cross_validate.py

1. Expanding-window CV over the train+validation period (4 folds). Each fold trains on the
   past and is scored on the next, unseen slice - never the other way round.
2. Ablation: retrain without a feature group and score the held-out test set, overall and on
   the cold-start segment (first payments to a recipient, before any complaint exists).

Output: evaluation/cross_validation.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
from sklearn.metrics import average_precision_score, precision_score, recall_score  # noqa: E402
from sklearn.model_selection import TimeSeriesSplit  # noqa: E402

from features.feature_engineering import FEATURE_NAMES  # noqa: E402
from paths import EVAL_DIR, MODELS_DIR  # noqa: E402
from training.common import build_fallback, build_xgboost, load_dataset, time_split  # noqa: E402

GROUPS = {
    "graph": ["graph_degree", "graph_risk_score", "connected_blocked_accounts", "connected_scam_accounts",
              "connected_victims", "distance_to_blocked_entity"],
    "complaints": ["recipient_complaint_count", "recipient_complaint_rate", "connected_victims"],
    "recipient_velocity_and_history": [
        "transactions_last_5min", "transactions_last_1hr", "transactions_last_24hr", "amount_last_1hr",
        "amount_last_24hr", "recipient_transaction_count", "unique_senders_to_recipient", "same_amount_ratio",
        "fund_transfer_velocity"],
    "device_and_network": ["unique_devices", "unique_ips", "sender_device_age", "recipient_device_age",
                           "device_user_count", "ip_user_count", "sender_device_user_count", "new_device", "new_ip"],
}


def fit(train, val, feats, n_trees):
    try:
        clf, _ = build_xgboost(n_estimators=n_trees, early_stopping_rounds=None)
        clf.fit(train[feats].to_numpy(), train.is_fraud.to_numpy(), verbose=False)
    except Exception:
        clf, _ = build_fallback(max_iter=n_trees, early_stopping=False)
        clf.fit(train[feats].to_numpy(), train.is_fraud.to_numpy())
    return clf


def main() -> None:
    df = load_dataset()
    train, val, test, _ = time_split(df)
    meta = json.loads((MODELS_DIR / "v1" / "metadata.json").read_text())
    n_trees, threshold = int(meta["bestIteration"]), float(meta["decisionThreshold"])

    dev = df.iloc[: len(train) + len(val)]
    folds = []
    for k, (tr_idx, te_idx) in enumerate(TimeSeriesSplit(n_splits=4).split(dev), start=1):
        tr, te = dev.iloc[tr_idx], dev.iloc[te_idx]
        clf = fit(tr, None, FEATURE_NAMES, n_trees)
        p = clf.predict_proba(te[FEATURE_NAMES].to_numpy())[:, 1]
        pred = p >= threshold
        folds.append({
            "fold": k, "trainRows": int(len(tr)), "testRows": int(len(te)), "testFraud": int(te.is_fraud.sum()),
            "prAuc": round(float(average_precision_score(te.is_fraud, p)), 4),
            "precision": round(float(precision_score(te.is_fraud, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(te.is_fraud, pred, zero_division=0)), 4),
        })
        print(folds[-1])
    summary = {k: {"mean": round(float(np.mean([f[k] for f in folds])), 4), "std": round(float(np.std([f[k] for f in folds])), 4)}
               for k in ("prAuc", "precision", "recall")}

    cold = ((test.recipient_transaction_count < 5) & (test.recipient_complaint_count == 0)).to_numpy()
    y = test.is_fraud.to_numpy()
    ablation = []
    for name, drop in [("all features", [])] + [(f"without {g}", cols) for g, cols in GROUPS.items()]:
        feats = [f for f in FEATURE_NAMES if f not in drop]
        clf = fit(train, val, feats, n_trees)
        p = clf.predict_proba(test[feats].to_numpy())[:, 1]
        row = {"configuration": name, "features": len(feats),
               "prAuc": round(float(average_precision_score(y, p)), 4)}
        if cold.sum() and 0 < y[cold].sum() < cold.sum():
            row["coldStartPrAuc"] = round(float(average_precision_score(y[cold], p[cold])), 4)
        ablation.append(row)
        print(row)

    out = {
        "method": "expanding-window time-series CV on train+validation; ablation on the future test set",
        "folds": folds, "summary": summary, "ablation": ablation,
        "caveat": "Synthetic data: many independent fraud traces make it easier than production traffic.",
    }
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    (EVAL_DIR / "cross_validation.json").write_text(json.dumps(out, indent=2))
    print("summary:", summary)


if __name__ == "__main__":
    main()
