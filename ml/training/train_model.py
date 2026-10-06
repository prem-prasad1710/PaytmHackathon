"""Train the fraud model and register it.

    python ml/training/train_model.py [--version v1] [--force-fallback]

Pipeline
  1. load dataset/processed/transactions.csv (features were built point-in-time)
  2. chronological 70/15/15 split
  3. baseline: Logistic Regression (scaled, signed-log features)
  4. main model: XGBoost with early stopping on the VALIDATION set
     (falls back to sklearn HistGradientBoosting if XGBoost cannot be imported)
  5. decision threshold = best-F1 point on the validation set
  6. save models/<version>/{model.json|model.joblib, baseline_lr.joblib, metadata.json, scam_dna.json}
  7. evaluate on the untouched TEST set -> evaluation/metrics.json (+ charts, importance)
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
import numpy as np  # noqa: E402
import sklearn  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import FunctionTransformer, StandardScaler  # noqa: E402

from features.feature_engineering import FEATURE_LABELS, FEATURE_NAMES  # noqa: E402
from inference.predict import signed_log1p  # noqa: E402
from paths import MODELS_DIR  # noqa: E402
from training import evaluate_model  # noqa: E402
from training.common import (SEED, build_fallback, build_xgboost, load_dataset, pick_threshold,  # noqa: E402
                             time_split, xy)

SCAM_TYPE_LABELS = {
    "phishing_kyc": "Phishing / KYC scam",
    "reward_scam": "Reward / prize scam",
    "investment_scam": "Investment scam",
    "job_scam": "Job / task scam",
    "account_takeover": "Account takeover",
    "money_mule": "Money-mule network",
}


def build_baseline() -> object:
    return make_pipeline(
        FunctionTransformer(signed_log1p), StandardScaler(),
        LogisticRegression(max_iter=1000, class_weight="balanced", C=1.0, random_state=SEED),
    )


def train_main_model(X_tr, y_tr, X_val, y_val, force_fallback: bool):
    """Returns (fitted_model, algorithm_name, library_version, hyperparameters, best_iteration)."""
    if not force_fallback:
        try:
            clf, params = build_xgboost()
            clf.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
            import xgboost

            return clf, "XGBoost", xgboost.__version__, params, int(clf.best_iteration) + 1
        except Exception as exc:  # ImportError or XGBoostError (e.g. missing libomp on macOS)
            print(f"! XGBoost unavailable ({type(exc).__name__}); using sklearn HistGradientBoosting", file=sys.stderr)
    clf, params = build_fallback()
    clf.fit(X_tr, y_tr)
    return clf, "HistGradientBoosting", sklearn.__version__, params, int(clf.n_iter_)


def build_scam_dna(train_df, names) -> dict:
    X = signed_log1p(train_df[names].to_numpy(dtype=np.float64))
    mean, std = X.mean(axis=0), np.maximum(X.std(axis=0), 1e-6)
    types = {}
    for stype in SCAM_TYPE_LABELS:
        rows = train_df[train_df.scam_type == stype]
        if len(rows) < 20:
            continue
        z = ((signed_log1p(rows[names].to_numpy(dtype=np.float64)) - mean) / std).mean(axis=0)
        order = np.argsort(-np.abs(z))[:6]
        types[stype] = {
            "label": SCAM_TYPE_LABELS[stype],
            "count": int(len(rows)),
            "centroid": [round(float(v), 4) for v in z],
            "signature": [{"feature": names[i], "label": FEATURE_LABELS[names[i]], "z": round(float(z[i]), 2)} for i in order],
        }
    return {"featureNames": list(names), "mean": mean.round(5).tolist(), "std": std.round(5).tolist(), "types": types,
            "method": "mean standardised (signed-log) feature vector of confirmed fraud per scam type, compared by cosine similarity"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default="v1")
    parser.add_argument("--force-fallback", action="store_true")
    args = parser.parse_args()

    df = load_dataset()
    train, val, test, split = time_split(df)
    X_tr, y_tr = xy(train)
    X_val, y_val = xy(val)
    print(f"train {len(train):,} | validation {len(val):,} | test {len(test):,} | fraud rate {df.is_fraud.mean():.2%}")

    t0 = time.time()
    baseline = build_baseline().fit(X_tr, y_tr)
    baseline_threshold = pick_threshold(y_val, baseline.predict_proba(X_val)[:, 1])

    clf, algorithm, lib_version, params, best_iter = train_main_model(X_tr, y_tr, X_val, y_val, args.force_fallback)
    threshold = pick_threshold(y_val, clf.predict_proba(X_val)[:, 1])
    print(f"trained {algorithm} ({best_iter} trees) in {time.time() - t0:.1f}s, threshold {threshold:.3f}")

    out_dir = MODELS_DIR / args.version
    out_dir.mkdir(parents=True, exist_ok=True)
    if algorithm == "XGBoost":
        clf.get_booster().save_model(str(out_dir / "model.json"))
        (out_dir / "model.joblib").unlink(missing_ok=True)
    else:
        joblib.dump(clf, out_dir / "model.joblib")
        (out_dir / "model.json").unlink(missing_ok=True)
    joblib.dump({"pipeline": baseline, "threshold": baseline_threshold}, out_dir / "baseline_lr.joblib")
    (out_dir / "scam_dna.json").write_text(json.dumps(build_scam_dna(train, FEATURE_NAMES)))

    safe_params = {k: (v if isinstance(v, (int, float, str, bool, type(None))) else str(v)) for k, v in params.items()}
    metadata = {
        "version": args.version,
        "modelVersion": f"{args.version}.0",
        "algorithm": algorithm,
        "libraryVersion": lib_version,
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "features": len(FEATURE_NAMES),
        "featureNames": FEATURE_NAMES,
        "trainingSamples": int(len(train)),
        "validationSamples": int(len(val)),
        "testSamples": int(len(test)),
        "fraudSamples": int(train.is_fraud.sum()),
        "totalSamples": int(len(df)),
        "bestIteration": best_iter,
        "hyperparameters": safe_params,
        "decisionThreshold": round(threshold, 4),
        "thresholdPolicy": "probability maximising F1 on the validation split",
        "classWeighting": "none (trained on natural class balance so probabilities stay calibrated)",
        "seed": SEED,
        "split": split,
        "featureBaseline": [float(v) for v in np.median(X_tr, axis=0)],
        "baselineModel": {"algorithm": "LogisticRegression", "threshold": round(baseline_threshold, 4)},
        "metrics": {},
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))

    metrics = evaluate_model.run(args.version, df=df)
    metadata["metrics"] = {k: metrics["test"][k] for k in ("precision", "recall", "f1", "rocAuc", "prAuc")}
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))

    registry_path = MODELS_DIR / "registry.json"
    registry = json.loads(registry_path.read_text()) if registry_path.exists() else {"versions": {}}
    registry["active"] = args.version
    registry["versions"][args.version] = {
        "modelVersion": metadata["modelVersion"], "algorithm": algorithm,
        "createdAt": metadata["trainedAt"], "metrics": metadata["metrics"],
    }
    registry_path.write_text(json.dumps(registry, indent=2))

    t = metrics["test"]
    print(f"\nTEST (future 15%)  precision {t['precision']:.3f}  recall {t['recall']:.3f}  f1 {t['f1']:.3f}  "
          f"ROC-AUC {t['rocAuc']:.3f}  PR-AUC {t['prAuc']:.3f}  FPR {t['falsePositiveRate']:.4f}")
    print(f"registered {out_dir}")


if __name__ == "__main__":
    main()
