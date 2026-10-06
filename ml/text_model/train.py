"""Train the scam text classifier + transaction anomaly model.

    python train.py

Writes artifacts/ (joblib models + metrics.json). Metrics are computed on
templates that were *held out of training* so they reflect unseen wording.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from text_model.dataset import build_templates, render  # noqa: E402
from text_model.features import TXN_FEATURES, text_matrix, txn_vector  # noqa: E402

ART = Path(__file__).parent / "artifacts"
ART.mkdir(exist_ok=True)
SEED = 7


def fit_text_models(train_rows):
    texts = [r["text"] for r in train_rows]
    word_vec = TfidfVectorizer(ngram_range=(1, 2), min_df=2, lowercase=True, sublinear_tf=True,
                               token_pattern=r"(?u)\b[\w']+\b")
    char_vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=3, sublinear_tf=True)
    word_vec.fit(texts)
    char_vec.fit(texts)
    X = text_matrix(word_vec, char_vec, texts)

    binary = LogisticRegression(C=4.0, max_iter=2000, class_weight="balanced")
    binary.fit(X, [r["scam"] for r in train_rows])

    scam_idx = [i for i, r in enumerate(train_rows) if r["scam"]]
    category = LogisticRegression(C=6.0, max_iter=3000)
    category.fit(X[scam_idx], [train_rows[i]["category"] for i in scam_idx])
    return word_vec, char_vec, binary, category


def train_text(folds: int = 5):
    templates = build_templates()
    rng = random.Random(SEED)

    by_cat: dict[str, list[dict]] = {}
    for t in templates:
        by_cat.setdefault(t["category"], []).append(t)
    fold_of: dict[int, int] = {}
    for items in by_cat.values():
        items = items[:]
        rng.shuffle(items)
        for i, t in enumerate(items):
            fold_of[t["tid"]] = i % folds

    ys: list[int] = []
    probs: list[float] = []
    cat_true: list[str] = []
    cat_pred_all: list[str] = []
    for f in range(folds):
        train_t = [t for t in templates if fold_of[t["tid"]] != f]
        held = [t for t in templates if fold_of[t["tid"]] == f]
        train_rows = render(train_t, per_template=50, seed=SEED + f)
        test_rows = render(held, per_template=30, seed=SEED + 100 + f)
        word_vec, char_vec, binary, category = fit_text_models(train_rows)
        Xt = text_matrix(word_vec, char_vec, [r["text"] for r in test_rows])
        ys.extend(r["scam"] for r in test_rows)
        probs.extend(binary.predict_proba(Xt)[:, 1])
        scam_test = [r for r in test_rows if r["scam"]]
        Xs = text_matrix(word_vec, char_vec, [r["text"] for r in scam_test])
        cat_true.extend(r["category"] for r in scam_test)
        cat_pred_all.extend(category.predict(Xs))

    y = np.array(ys)
    prob = np.array(probs)
    pred = (prob >= 0.5).astype(int)
    cat_acc = accuracy_score(cat_true, cat_pred_all)

    metrics = {
        "dataset": {
            "note": "Synthetic English/Hinglish templates. Metrics are 5-fold cross-validation grouped by "
                    "template, so every test message uses wording unseen in training. Retrain with real "
                    "labelled data (e.g. UCI SMS Spam, user-reported scams) for production.",
            "templates_total": len(templates),
            "cv_folds": folds,
            "evaluated_samples": int(len(y)),
        },
        "binary": {
            "precision": round(precision_score(y, pred), 4),
            "recall": round(recall_score(y, pred), 4),
            "f1": round(f1_score(y, pred), 4),
            "roc_auc": round(roc_auc_score(y, prob), 4),
            "confusion_matrix": confusion_matrix(y, pred).tolist(),
            "labels": ["legit", "scam"],
        },
        "category_accuracy": round(cat_acc, 4),
    }

    all_rows = render(templates, per_template=60, seed=SEED + 2)
    final = fit_text_models(all_rows)
    joblib.dump({"word": final[0], "char": final[1], "binary": final[2], "category": final[3]},
                ART / "text_model.joblib")
    return metrics


def train_anomaly():
    rng = np.random.default_rng(SEED)
    n = 6000
    amount_ratio = rng.lognormal(0, 0.7, n)
    new_payee = rng.random(n) < 0.30
    hour = np.where(rng.random(n) < 0.97, rng.integers(7, 23, n), rng.integers(23, 29, n) % 24)
    velocity = rng.poisson(0.4, n)
    complaints = np.where(rng.random(n) < 0.02, rng.integers(1, 4, n), 0)
    collect = rng.random(n) < 0.04

    X = np.array([
        txn_vector(r * 1000, 1000, bool(a), int(h), int(v), int(c), bool(col))
        for r, a, h, v, c, col in zip(amount_ratio, new_payee, hour, velocity, complaints, collect)
    ])
    iso = IsolationForest(n_estimators=250, contamination=0.02, random_state=SEED)
    iso.fit(X)
    normal_scores = -iso.score_samples(X)

    mean, std = X.mean(axis=0), X.std(axis=0) + 1e-6
    joblib.dump({"iso": iso, "normal_scores": np.sort(normal_scores), "mean": mean, "std": std},
                ART / "anomaly_model.joblib")

    attacks = np.array([
        txn_vector(25000, 800, True, 2, 4, 31, True),
        txn_vector(49500, 1200, True, 14, 0, 18, False),
        txn_vector(999, 1000, False, 12, 0, 0, False),
        txn_vector(240, 800, True, 13, 0, 0, False),
    ])
    atk = -iso.score_samples(attacks)
    pct = [round(float((normal_scores < s).mean() * 100), 1) for s in atk]
    return {"features": TXN_FEATURES, "sanity_percentiles": {"scam_like_1": pct[0], "scam_like_2": pct[1],
                                                           "normal_payment": pct[2],
                                                           "new_payee_normal_amount": pct[3]}}


if __name__ == "__main__":
    m = train_text()
    m["anomaly"] = train_anomaly()
    (ART / "metrics.json").write_text(json.dumps(m, indent=2))
    print(json.dumps(m, indent=2))
