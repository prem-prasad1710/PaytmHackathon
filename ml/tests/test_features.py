import math

import pytest

from features.feature_engineering import (
    DAY, FEATURE_NAMES, FeatureStore, build_transaction_features, validate_transaction,
)
from dataset.simulator import START_TS

T0 = START_TS + 42 * DAY + 10.5 * 3600  # 10:30 IST, Thursday 12 Feb 2026 (START_TS is a Thursday)


def acct(store, account_id, age_days, device=None, ip=None, ts=T0):
    store.apply({"type": "account_created", "ts": ts - age_days * DAY, "account_id": account_id,
                 "device_id": device or f"D_{account_id}", "ip_id": ip or f"IP_{account_id}"})


def pay(store, ts, sender, recipient, amount, device=None, ip=None):
    store.apply({"type": "transaction", "ts": ts, "sender_id": sender, "recipient_id": recipient,
                 "amount": amount, "device_id": device or f"D_{sender}", "ip_id": ip or f"IP_{sender}"})


def tx(ts, sender, recipient, amount, device=None, ip=None):
    return {"ts": ts, "sender_id": sender, "recipient_id": recipient, "amount": amount,
            "device_id": device or f"D_{sender}", "ip_id": ip or f"IP_{sender}"}


@pytest.fixture
def store():
    s = FeatureStore()
    acct(s, "alice", 400)
    acct(s, "scam", 3)
    for i in range(5):
        acct(s, f"victim{i}", 200)
    return s


def test_vector_has_every_feature_and_is_finite(store):
    f = build_transaction_features(tx(T0, "alice", "scam", 99), store)
    assert list(f) == FEATURE_NAMES
    assert all(math.isfinite(v) for v in f.values())


def test_account_age_and_time_features(store):
    f = build_transaction_features(tx(T0, "alice", "scam", 99), store)
    assert f["sender_account_age_days"] == pytest.approx(400, abs=0.01)
    assert f["recipient_account_age_days"] == pytest.approx(3, abs=0.01)
    assert f["hour_of_day"] == 10
    assert f["day_of_week"] == 3  # Thursday


def test_inbound_velocity_windows_and_unique_senders(store):
    for i in range(3):
        pay(store, T0 - 120 + i * 30, f"victim{i}", "scam", 49)
    pay(store, T0 - 1800, "victim3", "scam", 49)
    pay(store, T0 - 3 * 3600, "victim4", "scam", 100)
    f = build_transaction_features(tx(T0, "alice", "scam", 49), store)
    assert f["transactions_last_5min"] == 3
    assert f["transactions_last_1hr"] == 4
    assert f["transactions_last_24hr"] == 5
    assert f["amount_last_1hr"] == 4 * 49
    assert f["amount_last_24hr"] == 4 * 49 + 100
    assert f["unique_senders_to_recipient"] == 5
    assert f["recipient_transaction_count"] == 5
    assert f["same_amount_ratio"] == pytest.approx(4 / 5)


def test_current_transaction_is_not_counted_until_applied(store):
    t = tx(T0, "alice", "scam", 49)
    assert build_transaction_features(t, store) == build_transaction_features(t, store)
    assert build_transaction_features(t, store)["transactions_last_5min"] == 0
    pay(store, T0, "alice", "scam", 49)
    assert build_transaction_features(tx(T0 + 5, "victim0", "scam", 49), store)["transactions_last_5min"] == 1


def test_new_recipient_flag_and_pair_history(store):
    assert build_transaction_features(tx(T0, "alice", "scam", 100), store)["new_recipient"] == 1
    pay(store, T0 - 600, "alice", "scam", 100)
    f = build_transaction_features(tx(T0, "alice", "scam", 300), store)
    assert f["new_recipient"] == 0
    assert f["sender_prior_payments_to_recipient"] == 1
    assert f["amount_growth_vs_prior"] == pytest.approx(3.0)


def test_complaint_rate_uses_only_complaints_filed_before(store):
    for i in range(4):
        pay(store, T0 - 5000 + i, f"victim{i}", "scam", 49)
    store.apply({"type": "complaint", "ts": T0 - 100, "account_id": "scam", "reporter_id": "victim0"})
    f = build_transaction_features(tx(T0, "alice", "scam", 49), store)
    assert f["recipient_complaint_count"] == 1
    assert f["recipient_complaint_rate"] == pytest.approx(1 / 4)
    assert build_transaction_features(tx(T0 - 200, "alice", "scam", 49), FeatureStore())["recipient_complaint_count"] == 0


def test_new_device_and_ip_detection(store):
    pay(store, T0 - 5 * DAY, "alice", "victim0", 100)
    known = build_transaction_features(tx(T0, "alice", "scam", 100), store)
    assert known["new_device"] == 0 and known["new_ip"] == 0
    stolen = build_transaction_features(tx(T0, "alice", "scam", 100, device="D_attacker", ip="IP_attacker"), store)
    assert stolen["new_device"] == 1 and stolen["new_ip"] == 1
    assert stolen["unique_devices"] == known["unique_devices"] + 1
    assert stolen["sender_device_age"] == 0


def test_amount_and_velocity_zscores_flag_unusual_behaviour(store):
    for i in range(30):
        pay(store, T0 - (40 - i) * 3600 * 6, "alice", "victim1", 400 + (i % 5) * 10)
    normal = build_transaction_features(tx(T0, "alice", "victim1", 420), store)
    huge = build_transaction_features(tx(T0, "alice", "victim1", 40_000), store)
    assert abs(normal["amount_zscore"]) < 1.5
    assert huge["amount_zscore"] > 4
    for k in range(6):
        pay(store, T0 - 600 + k * 60, "alice", "victim1", 420)
    burst = build_transaction_features(tx(T0, "alice", "victim1", 420), store)
    assert burst["velocity_zscore"] > normal["velocity_zscore"] + 5


def test_fund_transfer_velocity_detects_pass_through(store):
    acct(store, "collector", 10)
    pay(store, T0 - 1200, "victim0", "scam", 1000)
    pay(store, T0 - 600, "victim1", "scam", 1000)
    pay(store, T0 - 300, "scam", "collector", 1900)
    f = build_transaction_features(tx(T0, "victim2", "scam", 1000), store)
    assert f["fund_transfer_velocity"] == pytest.approx(0.95)
    again = build_transaction_features(tx(T0, "scam", "collector", 1900), store)
    assert again["sender_pass_through_ratio"] == pytest.approx(2000 / 3800)

    acct(store, "mule", 40)
    pay(store, T0 - 200, "victim3", "mule", 2000)
    forward = build_transaction_features(tx(T0, "mule", "collector", 1900), store)
    assert forward["sender_pass_through_ratio"] == pytest.approx(1.0)
    assert build_transaction_features(tx(T0, "alice", "collector", 1900), store)["sender_pass_through_ratio"] == 0


def test_device_sharing_and_ring_graph(store):
    acct(store, "ring_a", 4, device="D_RING")
    acct(store, "ring_b", 4, device="D_RING")
    acct(store, "ring_c", 4, device="D_RING")
    base = build_transaction_features(tx(T0, "alice", "ring_a", 99), store)
    assert base["device_user_count"] == 3
    assert base["connected_blocked_accounts"] == 0
    store.apply({"type": "block", "ts": T0 - 3600, "account_id": "ring_b"})
    f = build_transaction_features(tx(T0, "alice", "ring_a", 99), store)
    assert f["connected_blocked_accounts"] == 1
    assert f["distance_to_blocked_entity"] == 1
    assert f["graph_risk_score"] >= 60


def test_blocked_recipient_gets_maximum_graph_risk(store):
    store.apply({"type": "block", "ts": T0 - 10, "account_id": "scam"})
    f = build_transaction_features(tx(T0, "alice", "scam", 99), store)
    assert f["graph_risk_score"] == 100
    assert f["distance_to_blocked_entity"] == 0


def test_unknown_accounts_degrade_gracefully():
    f = build_transaction_features(tx(T0, "ghost_sender", "ghost_recipient", 250), FeatureStore())
    assert f["recipient_account_age_days"] == 0
    assert f["new_recipient"] == 1
    assert f["recipient_transaction_count"] == 0
    assert all(math.isfinite(v) for v in f.values())


def test_missing_device_and_ip_are_tolerated(store):
    f = build_transaction_features({"ts": T0, "sender_id": "alice", "recipient_id": "scam", "amount": 50}, store)
    assert f["new_device"] == 0 and f["new_ip"] == 0


@pytest.mark.parametrize("bad", [
    {"ts": T0, "sender_id": "a", "recipient_id": "b", "amount": -5},
    {"ts": T0, "sender_id": "a", "recipient_id": "b", "amount": 0},
    {"ts": T0, "sender_id": "a", "recipient_id": "b", "amount": float("nan")},
    {"ts": T0, "sender_id": "a", "recipient_id": "b", "amount": "abc"},
    {"ts": T0, "sender_id": "a", "recipient_id": "a", "amount": 5},
    {"ts": T0, "sender_id": "", "recipient_id": "b", "amount": 5},
    {"ts": T0, "recipient_id": "b", "amount": 5},
    {"sender_id": "a", "recipient_id": "b", "amount": 5},
])
def test_invalid_transactions_are_rejected(bad):
    with pytest.raises(ValueError):
        validate_transaction(bad)
