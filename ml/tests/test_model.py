import json

import numpy as np
import pytest

from features.feature_engineering import FEATURE_NAMES
from inference.predict import FraudModel
from paths import EVAL_DIR, MODELS_DIR
from training.common import classification_metrics, load_dataset, time_split, xy

pytestmark = pytest.mark.skipif(not (MODELS_DIR / "v1" / "metadata.json").exists(), reason="run `npm run train:ml` first")


@pytest.fixture(scope="module")
def model():
    return FraudModel()


@pytest.fixture(scope="module")
def splits():
    return time_split(load_dataset())


def test_model_loads_with_metadata(model):
    assert model.feature_names == FEATURE_NAMES
    assert 0 < model.threshold < 1
    assert model.algorithm in {"XGBoost", "HistGradientBoosting"}
    for key in ("modelVersion", "trainedAt", "features", "trainingSamples", "fraudSamples", "hyperparameters", "seed"):
        assert key in model.metadata
    assert model.metadata["features"] == len(FEATURE_NAMES)
    registry = json.loads((MODELS_DIR / "registry.json").read_text())
    assert registry["active"] in registry["versions"]


def test_probabilities_are_between_zero_and_one(model, splits):
    _, _, test, _ = splits
    X, _ = xy(test.head(2000))
    p = model.predict_proba(X)
    assert p.shape == (2000,)
    assert np.isfinite(p).all() and p.min() >= 0 and p.max() <= 1


def test_model_separates_fraud_from_legit(model, splits):
    _, _, test, _ = splits
    X, y = xy(test)
    p = model.predict_proba(X)
    assert p[y == 1].mean() > 0.8 > 0.1 > p[y == 0].mean()


def test_saved_metrics_are_reproducible_from_the_saved_model(model, splits):
    """Metrics must come from running the model on the held-out set, never hard-coded."""
    _, _, test, _ = splits
    X, y = xy(test)
    fresh = classification_metrics(y, model.predict_proba(X), model.threshold)
    saved = json.loads((EVAL_DIR / "metrics.json").read_text())["test"]
    for key in ("precision", "recall", "f1", "rocAuc", "prAuc", "falsePositiveRate", "falseNegativeRate"):
        assert fresh[key] == pytest.approx(saved[key], abs=1e-3), key
    assert fresh["confusionMatrix"] == saved["confusionMatrix"]
    assert json.loads((MODELS_DIR / "v1" / "metrics.json").read_text())["test"]["prAuc"] == saved["prAuc"]


def test_split_is_chronological_with_no_overlap(splits):
    train, val, test, info = splits
    assert train.timestamp.max() <= val.timestamp.min() <= val.timestamp.max() <= test.timestamp.min()
    assert abs(len(train) / (len(train) + len(val) + len(test)) - 0.70) < 0.01
    assert "chronological" in info["strategy"]


def test_xgboost_contributions_are_additive(model, splits):
    if model._booster is None:
        pytest.skip("fallback model")
    import xgboost as xgb

    _, _, test, _ = splits
    X, _ = xy(test.head(50))
    dm = xgb.DMatrix(X)
    contribs = model._booster.predict(dm, pred_contribs=True)
    margin = model._booster.predict(dm, output_margin=True)
    np.testing.assert_allclose(contribs.sum(axis=1), margin, atol=1e-3)


def test_score_returns_ranked_human_readable_factors(model, splits):
    _, _, test, _ = splits
    row = test[test.is_fraud == 1].iloc[0][FEATURE_NAMES].to_dict()
    out = model.score(row)
    assert 0 <= out["fraudProbability"] <= 1
    assert out["riskScore"] == round(out["fraudProbability"] * 100)
    assert out["topFactors"], "a flagged payment must have at least one explanation"
    contributions = [f["contribution"] for f in out["topFactors"]]
    assert contributions == sorted(contributions, reverse=True)
    assert all(f["impact"] in {"high", "medium", "low"} and f["text"] for f in out["topFactors"])
    assert out["scamDna"] and out["scamDna"][0]["similarity"] >= out["scamDna"][-1]["similarity"]


def test_inference_is_fast_enough(model, splits):
    import time

    _, _, test, _ = splits
    rows = test.head(100)[FEATURE_NAMES].to_dict("records")
    model.score(rows[0])
    start = time.perf_counter()
    for r in rows:
        model.score(r)
    assert (time.perf_counter() - start) / len(rows) * 1000 < 100


def test_fallback_gradient_boosting_trains_and_scores(splits):
    from training.train_model import train_main_model

    train, val, _, _ = splits
    Xtr, ytr = xy(train.iloc[::6])
    Xv, yv = xy(val.iloc[::3])
    clf, algorithm, _, params, iterations = train_main_model(Xtr, ytr, Xv, yv, force_fallback=True)
    assert algorithm == "HistGradientBoosting" and iterations > 0
    p = clf.predict_proba(Xv)[:, 1]
    assert 0 <= p.min() and p.max() <= 1


def test_baseline_comparison_is_generated_not_hard_coded():
    metrics = json.loads((EVAL_DIR / "metrics.json").read_text())
    lr = metrics["comparison"]["logisticRegression"]
    primary = metrics["comparison"]["primary"]
    assert set(("precision", "recall", "f1", "prAuc")) <= set(lr) and lr["prAuc"] != primary["prAuc"]
