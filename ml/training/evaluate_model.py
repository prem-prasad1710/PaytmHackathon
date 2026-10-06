"""Evaluate a registered model on the held-out, chronologically LAST 15% of transactions.

    python ml/training/evaluate_model.py [--version v1]

Writes (nothing is hard-coded - every number comes from running the model):
    evaluation/metrics.json            test/validation metrics, baseline comparison, per-scam-type recall
    evaluation/feature_importance.json gain + mean |SHAP| per feature
    evaluation/confusion_matrix.png / feature_importance.png / pr_curve.png
    models/<version>/metrics.json      copy stored next to the model in the registry
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import joblib  # noqa: E402
import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.metrics import precision_recall_curve  # noqa: E402

from features.feature_engineering import FEATURE_LABELS, FEATURE_NAMES  # noqa: E402
from inference.predict import FraudModel  # noqa: E402
from paths import EVAL_DIR, MODELS_DIR  # noqa: E402
from training.common import classification_metrics, load_dataset, reliability_table, time_split, xy  # noqa: E402

NAVY, BLUE, RED = "#002970", "#00baf2", "#e5484d"


def measure_latency(model: FraudModel, df, n: int = 300) -> dict:
    rows = df.sample(min(n, len(df)), random_state=0)[FEATURE_NAMES].to_dict("records")
    model.score(rows[0])
    times = []
    for r in rows:
        t = time.perf_counter()
        model.score(r)
        times.append((time.perf_counter() - t) * 1000)
    return {"meanMs": round(float(np.mean(times)), 2), "p95Ms": round(float(np.percentile(times, 95)), 2),
            "samples": len(times), "includesExplanation": True}


def feature_importance(model: FraudModel, test_df) -> list:
    sample = test_df.sample(min(4000, len(test_df)), random_state=0)
    X = sample[FEATURE_NAMES].to_numpy(dtype=np.float64)
    shap = np.abs(model.contributions(X)).mean(axis=0)
    gain = np.zeros(len(FEATURE_NAMES))
    if model._booster is not None:
        scores = model._booster.get_score(importance_type="gain")
        for key, val in scores.items():
            gain[int(key[1:])] = val
    shap_share = shap / shap.sum() if shap.sum() else shap
    gain_share = gain / gain.sum() if gain.sum() else gain
    rows = [{"feature": f, "label": FEATURE_LABELS[f], "meanAbsContribution": round(float(s), 4),
             "importanceShare": round(float(ss), 4), "gainShare": round(float(gs), 4)}
            for f, s, ss, gs in zip(FEATURE_NAMES, shap, shap_share, gain_share)]
    rows.sort(key=lambda r: -r["importanceShare"])
    return rows


def plot_charts(test_metrics: dict, importance: list, y_test, p_gbm, p_lr, algorithm: str) -> None:
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    cm = test_metrics["confusionMatrix"]
    grid = np.array([[cm["tn"], cm["fp"]], [cm["fn"], cm["tp"]]])
    fig, ax = plt.subplots(figsize=(4.4, 3.8))
    ax.imshow(grid, cmap="Blues")
    for (i, j), v in np.ndenumerate(grid):
        ax.text(j, i, f"{v:,}", ha="center", va="center", color="white" if v > grid.max() / 2 else NAVY, fontsize=13)
    ax.set_xticks([0, 1], ["Legit", "Fraud"])
    ax.set_yticks([0, 1], ["Legit", "Fraud"])
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title("Confusion matrix (future test set)")
    fig.tight_layout()
    fig.savefig(EVAL_DIR / "confusion_matrix.png", dpi=140)
    plt.close(fig)

    top = importance[:15][::-1]
    fig, ax = plt.subplots(figsize=(6.4, 4.8))
    ax.barh([r["label"] for r in top], [r["importanceShare"] * 100 for r in top], color=BLUE)
    ax.set_xlabel("Share of model decisions (mean |SHAP|, %)")
    ax.set_title(f"{algorithm} feature importance")
    fig.tight_layout()
    fig.savefig(EVAL_DIR / "feature_importance.png", dpi=140)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(5, 4))
    for p, name, color in ((p_gbm, algorithm, RED), (p_lr, "Logistic Regression", NAVY)):
        pr, rc, _ = precision_recall_curve(y_test, p)
        ax.plot(rc, pr, label=name, color=color)
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("Precision-recall (future test set)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(EVAL_DIR / "pr_curve.png", dpi=140)
    plt.close(fig)


def run(version: str = "v1", df=None) -> dict:
    df = df if df is not None else load_dataset()
    model = FraudModel(version)
    base_pack = joblib.load(MODELS_DIR / version / "baseline_lr.joblib")
    train, val, test, split = time_split(df)
    X_val, y_val = xy(val)
    X_te, y_te = xy(test)

    p_val, p_te = model.predict_proba(X_val), model.predict_proba(X_te)
    lr_val = base_pack["pipeline"].predict_proba(X_val)[:, 1]
    lr_te = base_pack["pipeline"].predict_proba(X_te)[:, 1]

    test_metrics = classification_metrics(y_te, p_te, model.threshold)
    lr_metrics = classification_metrics(y_te, lr_te, base_pack["threshold"])

    per_type = {}
    flagged = p_te >= model.threshold
    for stype in sorted(test.scam_type.unique()):
        if stype == "legit":
            continue
        mask = (test.scam_type == stype).to_numpy()
        per_type[stype] = {"samples": int(mask.sum()), "recall": round(float(flagged[mask].mean()), 4)}

    segments = {}
    for name, mask in {
        "coldStart": ((test.recipient_transaction_count < 5) & (test.recipient_complaint_count == 0)).to_numpy(),
        "recipientOlderThan30Days": (test.recipient_account_age_days >= 30).to_numpy(),
        "unrecognisedDevice": (test.new_device == 1).to_numpy(),
    }.items():
        if mask.sum() > 0 and 0 < y_te[mask].sum() < mask.sum():
            m = classification_metrics(y_te[mask], p_te[mask], model.threshold)
            segments[name] = {k: m[k] for k in ("samples", "fraudSamples", "precision", "recall", "f1", "prAuc")}

    importance = feature_importance(model, test)
    plot_charts(test_metrics, importance, y_te, p_te, lr_te, model.algorithm)
    (EVAL_DIR / "feature_importance.json").write_text(json.dumps(importance, indent=2))

    metrics = {
        "modelVersion": model.model_version,
        "algorithm": model.algorithm,
        "evaluatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "evaluationSet": "chronologically last 15% of transactions (never used for training or tuning)",
        "split": split,
        "test": test_metrics,
        "validation": classification_metrics(y_val, p_val, model.threshold),
        "comparison": {
            "logisticRegression": {"algorithm": "Logistic Regression", **lr_metrics},
            "primary": {"algorithm": model.algorithm, **test_metrics},
        },
        "perScamTypeRecall": per_type,
        "hardSegments": segments,
        "reliability": reliability_table(y_te, p_te),
        "latency": measure_latency(model, test),
        "dataLeakageControls": [
            "features computed from event state strictly before each payment",
            "chronological split: test set is the newest 15% of payments",
            "decision threshold chosen on validation, not test",
            "labels never used as inputs",
        ],
    }
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    (EVAL_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    (MODELS_DIR / version / "metrics.json").write_text(json.dumps(metrics, indent=2))
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default=None)
    args = parser.parse_args()
    from inference.predict import active_version

    m = run(args.version or active_version())
    t = m["test"]
    print(json.dumps({k: t[k] for k in ("precision", "recall", "f1", "rocAuc", "prAuc", "falsePositiveRate", "falseNegativeRate")}, indent=2))
    print("confusion:", t["confusionMatrix"])
    print("per scam type recall:", {k: v["recall"] for k, v in m["perScamTypeRecall"].items()})
    print("latency:", m["latency"])


if __name__ == "__main__":
    main()
