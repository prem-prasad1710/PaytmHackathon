"""Shared helpers for training, evaluation and cross-validation."""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.metrics import (average_precision_score, brier_score_loss, confusion_matrix,  # noqa: E402
                             log_loss, precision_recall_curve, roc_auc_score)

from features.feature_engineering import FEATURE_NAMES  # noqa: E402
from paths import DATASET_PATH  # noqa: E402

SEED = 42
TRAIN_FRAC, VAL_FRAC = 0.70, 0.15
POPULATION_FRAUD_RATE = 0.01


def load_dataset(path: Path = DATASET_PATH) -> pd.DataFrame:
    if not Path(path).exists():
        raise SystemExit(f"Dataset not found at {path}. Run: npm run dataset:ml")
    df = pd.read_csv(path)
    if not df["timestamp"].is_monotonic_increasing:
        df = df.sort_values("timestamp", kind="stable").reset_index(drop=True)
    return df


def time_split(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict]:
    """70% oldest -> train, next 15% -> validation, newest 15% -> test.

    Splitting by time (not at random) means the test set only contains payments that
    happened AFTER everything the model was trained and tuned on, so it measures how the
    model behaves on tomorrow's scams, including campaigns and rings it has never seen.
    """
    n = len(df)
    i1, i2 = int(n * TRAIN_FRAC), int(n * (TRAIN_FRAC + VAL_FRAC))
    parts = {"train": df.iloc[:i1], "validation": df.iloc[i1:i2], "test": df.iloc[i2:]}
    info = {
        name: {
            "rows": int(len(part)),
            "fraudRows": int(part.is_fraud.sum()),
            "fraudRate": round(float(part.is_fraud.mean()), 4),
            "from": float(part.timestamp.iloc[0]),
            "to": float(part.timestamp.iloc[-1]),
        }
        for name, part in parts.items()
    }
    info["strategy"] = "chronological 70/15/15 split by transaction timestamp (no shuffling)"
    return parts["train"], parts["validation"], parts["test"], info


def xy(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    return df[FEATURE_NAMES].to_numpy(dtype=np.float64), df["is_fraud"].to_numpy()


def pick_threshold(y: np.ndarray, p: np.ndarray) -> float:
    """Operating point = probability threshold with the best F1 on the VALIDATION set."""
    precision, recall, thresholds = precision_recall_curve(y, p)
    f1 = 2 * precision[:-1] * recall[:-1] / np.clip(precision[:-1] + recall[:-1], 1e-12, None)
    return float(thresholds[int(np.argmax(f1))])


def classification_metrics(y: np.ndarray, p: np.ndarray, threshold: float) -> Dict[str, object]:
    pred = (p >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    tn, fp, fn, tp = int(tn), int(fp), int(fn), int(tp)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    fpr = fp / (fp + tn) if fp + tn else 0.0
    fnr = fn / (fn + tp) if fn + tp else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    pi = POPULATION_FRAUD_RATE
    adj = recall * pi / (recall * pi + fpr * (1 - pi)) if (recall * pi + fpr * (1 - pi)) else 0.0
    return {
        "threshold": round(float(threshold), 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "rocAuc": round(float(roc_auc_score(y, p)), 4),
        "prAuc": round(float(average_precision_score(y, p)), 4),
        "falsePositiveRate": round(fpr, 5),
        "falseNegativeRate": round(fnr, 4),
        "confusionMatrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "logLoss": round(float(log_loss(y, np.clip(p, 1e-6, 1 - 1e-6))), 4),
        "brierScore": round(float(brier_score_loss(y, p)), 4),
        "precisionIfFraudRate1pct": round(adj, 4),
        "samples": int(len(y)),
        "fraudSamples": int(y.sum()),
    }


def reliability_table(y: np.ndarray, p: np.ndarray, bins: int = 10) -> list:
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges[1:-1]), 0, bins - 1)
    out = []
    for b in range(bins):
        mask = idx == b
        if mask.sum() == 0:
            continue
        out.append({"bin": f"{edges[b]:.1f}-{edges[b + 1]:.1f}", "count": int(mask.sum()),
                    "meanPredicted": round(float(p[mask].mean()), 4), "observedFraudRate": round(float(y[mask].mean()), 4)})
    return out


def build_xgboost(**overrides):
    """XGBoost classifier; raises ImportError/XGBoostError if the library cannot load."""
    from xgboost import XGBClassifier

    params = dict(
        n_estimators=1200, learning_rate=0.05, max_depth=5, min_child_weight=3, subsample=0.85,
        colsample_bytree=0.85, reg_lambda=2.0, gamma=0.0, tree_method="hist", eval_metric="aucpr",
        early_stopping_rounds=40, random_state=SEED, n_jobs=4,
    )
    params.update(overrides)
    return XGBClassifier(**params), params


def build_fallback(**overrides):
    from sklearn.ensemble import HistGradientBoostingClassifier

    params = dict(max_iter=600, learning_rate=0.06, max_depth=6, l2_regularization=1.0,
                  early_stopping=True, validation_fraction=0.12, n_iter_no_change=30, random_state=SEED)
    params.update(overrides)
    return HistGradientBoostingClassifier(**params), params
