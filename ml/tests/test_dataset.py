import copy
import json

import numpy as np
import pytest
from sklearn.metrics import roc_auc_score

from dataset.simulator import SCAM_TYPES
from features.feature_engineering import FEATURE_NAMES, FeatureStore, build_transaction_features, replay
from paths import DATASET_PATH, EVAL_DIR


def test_events_are_time_ordered(small_events):
    ts = [e["ts"] for e in small_events]
    assert ts == sorted(ts)


def test_labels_are_binary_and_consistent(small_df):
    assert set(small_df.is_fraud.unique()) <= {0, 1}
    assert (small_df[small_df.is_fraud == 0].scam_type == "legit").all()
    assert (small_df[small_df.is_fraud == 1].scam_type != "legit").all()
    assert small_df.transaction_id.is_unique


def test_every_scam_type_is_present(small_df):
    present = set(small_df[small_df.is_fraud == 1].scam_type.unique())
    assert present == set(SCAM_TYPES)


def test_class_balance_is_realistic(small_df):
    rate = small_df.is_fraud.mean()
    assert 0.02 < rate < 0.15


def test_no_missing_or_infinite_values(small_df):
    values = small_df[FEATURE_NAMES].to_numpy(dtype=float)
    assert np.isfinite(values).all()


def test_fraud_distributions_differ_in_expected_directions(small_df):
    fraud, legit = small_df[small_df.is_fraud == 1], small_df[small_df.is_fraud == 0]
    assert fraud.recipient_account_age_days.median() < legit.recipient_account_age_days.median()
    assert fraud.recipient_complaint_rate.mean() > legit.recipient_complaint_rate.mean()
    assert fraud.same_amount_ratio.mean() > legit.same_amount_ratio.mean()
    assert fraud.graph_risk_score.mean() > legit.graph_risk_score.mean()
    assert fraud.amount.mean() > legit.amount.mean()


def test_no_single_feature_leaks_the_label(small_df):
    y = small_df.is_fraud.to_numpy()
    for name in FEATURE_NAMES:
        col = small_df[name].to_numpy()
        if np.ptp(col) == 0:
            continue
        auc = roc_auc_score(y, col)
        assert max(auc, 1 - auc) < 0.985, f"{name} separates the classes almost perfectly"


def test_feature_names_do_not_reference_the_future():
    banned = ("future", "label", "is_fraud", "after", "next_")
    assert not [n for n in FEATURE_NAMES if any(b in n for b in banned)]


def test_features_do_not_depend_on_labels(small_events):
    flipped = copy.deepcopy(small_events[:6000])
    for ev in flipped:
        if ev["type"] == "transaction":
            ev["is_fraud"] = 1 - ev["is_fraud"]
    a = [f for _, f in replay(small_events[:6000]) if f]
    b = [f for _, f in replay(flipped) if f]
    assert a == b


@pytest.mark.parametrize("fraction", [0.3, 0.6, 0.9])
def test_features_use_only_the_past(small_events, fraction):
    """Features for transaction i must be identical whether or not the future exists."""
    full = [(ev, f) for ev, f in replay(small_events) if f is not None]
    cut = int(len(small_events) * fraction)
    tx_index = next(i for i in range(cut, len(small_events)) if small_events[i]["type"] == "transaction")
    store = FeatureStore()
    for ev in small_events[:tx_index]:
        store.apply(ev)
    from_prefix = build_transaction_features(small_events[tx_index], store)
    expected = next(f for ev, f in full if ev is small_events[tx_index])
    assert from_prefix == expected


def test_future_complaint_does_not_change_current_features(small_events):
    tx_index = next(i for i in range(5000, len(small_events)) if small_events[i]["type"] == "transaction")
    tx = small_events[tx_index]
    store = FeatureStore()
    for ev in small_events[:tx_index]:
        store.apply(ev)
    before = build_transaction_features(tx, store)
    store.apply({"type": "complaint", "ts": tx["ts"] + 10, "account_id": tx["recipient_id"], "reporter_id": "X"})
    after_store = FeatureStore()
    for ev in small_events[:tx_index]:
        after_store.apply(ev)
    assert build_transaction_features(tx, after_store) == before


@pytest.mark.skipif(not DATASET_PATH.exists(), reason="run `npm run dataset:ml` first")
def test_generated_dataset_meets_spec():
    import pandas as pd

    df = pd.read_csv(DATASET_PATH, usecols=["is_fraud", "timestamp"])
    assert len(df) >= 100_000
    assert 0.02 < df.is_fraud.mean() < 0.15
    assert df.timestamp.is_monotonic_increasing
    report = json.loads((EVAL_DIR / "dataset_report.json").read_text())
    assert report["rows"] == len(df)
