import json
from pathlib import Path

import pytest

from features.feature_engineering import FeatureStore, build_transaction_features
from inference.predict import FraudModel
from paths import MODELS_DIR

WORLD = Path(__file__).resolve().parents[2] / "shared" / "fraudDemoWorld.json"
NOW = 1_800_000_000.0

pytestmark = pytest.mark.skipif(
    not (MODELS_DIR / "v1" / "metadata.json").exists() or not WORLD.exists(),
    reason="needs a trained model and shared/fraudDemoWorld.json",
)


@pytest.fixture(scope="module")
def model():
    return FraudModel()


@pytest.fixture(scope="module")
def world():
    return json.loads(WORLD.read_text())


def load(world, rename=None, drop=lambda e: False):
    store = FeatureStore()
    for ev in sorted(world["events"], key=lambda e: e["relTs"]):
        if drop(ev):
            continue
        e = {k: (rename.get(v, v) if isinstance(v, str) and rename else v) for k, v in ev.items()}
        e["ts"] = NOW + e.pop("relTs")
        store.apply(e)
    return store


def scenario_tx(world, name, rename=None):
    t = world["scenarios"][name]["transaction"]
    r = rename or {}
    return {"ts": NOW, "sender_id": t["senderId"], "recipient_id": r.get(t["recipientId"], t["recipientId"]),
            "amount": t["amount"], "device_id": t["deviceId"], "ip_id": t["ipAddress"]}


def test_scam_scenario_matches_the_specified_pattern(world, model):
    store = load(world)
    f = build_transaction_features(scenario_tx(world, "scam"), store)
    assert f["transactions_last_5min"] == 43
    assert f["recipient_account_age_days"] == pytest.approx(3, abs=0.01)
    assert f["recipient_complaint_count"] == 17
    assert f["recipient_complaint_rate"] == pytest.approx(0.31, abs=0.01)
    assert f["connected_blocked_accounts"] == 3
    assert f["device_user_count"] == 8
    assert f["fund_transfer_velocity"] > 0.8
    assert f["graph_risk_score"] >= 90
    assert model.score(f)["fraudProbability"] > 0.9


def test_three_demo_cases_are_ordered_by_the_model(world, model):
    store = load(world)
    p = {n: model.score(build_transaction_features(scenario_tx(world, n), store))["fraudProbability"]
         for n in ("normal", "suspicious", "scam")}
    assert p["normal"] < 0.05
    assert p["scam"] > 0.9
    assert p["normal"] < p["suspicious"]


def test_probability_comes_from_features_not_from_the_recipient_name(world, model):
    store_a = load(world)
    rename = {"scammer_demo@upi": "totally_unrelated_name@upi"}
    store_b = load(world, rename)
    a = model.score(build_transaction_features(scenario_tx(world, "scam"), store_a))
    b = model.score(build_transaction_features(scenario_tx(world, "scam", rename), store_b))
    assert a["fraudProbability"] == b["fraudProbability"]


def test_removing_the_evidence_lowers_the_prediction(world, model):
    full = model.score(build_transaction_features(scenario_tx(world, "scam"), load(world)))["fraudProbability"]

    def burst_or_complaint(e):
        return e.get("recipient_id") == "scammer_demo@upi" and e["type"] == "transaction" and e["relTs"] > -400 \
            or e["type"] == "complaint" and e["account_id"] == "scammer_demo@upi"

    stripped = load(world, drop=lambda e: burst_or_complaint(e) or e["type"] == "block")
    weaker = model.score(build_transaction_features(scenario_tx(world, "scam"), stripped))["fraudProbability"]
    assert weaker < full
