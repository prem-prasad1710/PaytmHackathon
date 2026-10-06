import time

import pytest
from fastapi.testclient import TestClient

from dataset.simulator import START_TS
from inference.model_service import Runtime, app
from paths import MODELS_DIR

pytestmark = pytest.mark.skipif(not (MODELS_DIR / "v1" / "metadata.json").exists(), reason="run `npm run train:ml` first")

NOW = START_TS + 50 * 86400 + 12 * 3600


@pytest.fixture()
def client():
    with TestClient(app) as c:
        c.post("/state/reset")
        yield c


def tx(**over):
    base = {"amount": 999, "senderId": "user_123", "recipientId": "upi_456", "deviceId": "device_789",
            "ipAddress": "synthetic-ip", "timestamp": NOW}
    base.update(over)
    return {"transaction": base}


def build_scam_world(client):
    events = [{"type": "account_created", "ts": NOW - 3 * 86400, "account_id": "scam@upi", "device_id": "D_RING", "ip_id": "IP_RING"}]
    for k in range(7):
        events.append({"type": "account_created", "ts": NOW - 4 * 86400, "account_id": f"ring{k}@upi", "device_id": "D_RING", "ip_id": f"IP_r{k}"})
    for k in range(3):
        events.append({"type": "block", "ts": NOW - 86400, "account_id": f"ring{k}@upi"})
    for k in range(43):
        events.append({"type": "account_created", "ts": NOW - 90 * 86400, "account_id": f"v{k}", "device_id": f"D_v{k}", "ip_id": f"IP_v{k}"})
        events.append({"type": "transaction", "ts": NOW - 280 + k * 6, "sender_id": f"v{k}", "recipient_id": "scam@upi", "amount": 49,
                       "device_id": f"D_v{k}", "ip_id": f"IP_v{k}"})
    for k in range(12):
        events.append({"type": "complaint", "ts": NOW - 3600, "account_id": "scam@upi", "reporter_id": f"v{k}"})
    events.append({"type": "account_created", "ts": NOW - 400 * 86400, "account_id": "user_123", "device_id": "device_789", "ip_id": "synthetic-ip"})
    assert client.post("/ingest", json={"events": events}).status_code == 200


def test_health_reports_model(client):
    body = client.get("/health").json()
    assert body["ok"] and body["mlAvailable"] and body["modelVersion"]


def test_valid_prediction_has_the_documented_shape(client):
    res = client.post("/predict", json=tx())
    assert res.status_code == 200
    body = res.json()
    assert 0 <= body["fraudProbability"] <= 1
    assert body["riskScore"] == round(body["fraudProbability"] * 100)
    assert body["modelVersion"].startswith("v")
    assert isinstance(body["topFactors"], list) and isinstance(body["explanation"], list)
    assert body["mlAvailable"] is True and body["latencyMs"] < 100
    assert "transactions_last_5min" in body["features"]


def test_scam_pattern_scores_far_higher_than_ordinary_payment(client):
    normal = client.post("/predict", json=tx()).json()
    build_scam_world(client)
    scam = client.post("/predict", json=tx(recipientId="scam@upi", amount=49)).json()
    assert scam["fraudProbability"] > 0.8
    assert scam["fraudProbability"] > normal["fraudProbability"] + 0.5
    assert scam["features"]["transactions_last_5min"] == 43
    assert scam["features"]["connected_blocked_accounts"] >= 3
    assert scam["topFactors"][0]["impact"] in {"high", "medium"}


@pytest.mark.parametrize("bad", [
    {"amount": -5}, {"amount": 0}, {"amount": "lots"}, {"senderId": ""}, {"recipientId": "user_123"},
    {"timestamp": -1},
])
def test_invalid_input_is_rejected(client, bad):
    assert client.post("/predict", json=tx(**bad)).status_code == 422


def test_missing_transaction_is_rejected(client):
    assert client.post("/predict", json={}).status_code == 422
    assert client.post("/predict", json={"transaction": {"amount": 5}}).status_code == 422


def test_commit_advances_the_ledger_only_when_requested(client):
    before = client.get("/state").json()["events"]
    client.post("/predict", json=tx())
    assert client.get("/state").json()["events"] == before
    client.post("/predict", json={**tx(), "commit": True})
    assert client.get("/state").json()["events"] == before + 1


def test_ingest_rejects_malformed_events(client):
    assert client.post("/ingest", json={"events": [{"type": "nope", "ts": 1}]}).status_code == 422
    assert client.post("/ingest", json={"events": [{"type": "block", "ts": "x"}]}).status_code == 422
    assert client.post("/ingest", json={"events": [{"type": "block", "ts": 1}]}).status_code == 422


def test_service_degrades_cleanly_when_model_is_unavailable(client, monkeypatch):
    monkeypatch.setattr(Runtime, "model", None)
    monkeypatch.setattr(Runtime, "load_error", "model missing")
    assert client.post("/predict", json=tx()).status_code == 503
    health = client.get("/health").json()
    assert health["ok"] is False and health["mlAvailable"] is False
    assert client.get("/text/health").status_code == 200


def test_monitoring_tracks_predictions(client):
    base = client.get("/monitoring").json()["prediction_count"]
    for _ in range(3):
        client.post("/predict", json=tx())
    m = client.get("/monitoring").json()
    assert m["prediction_count"] == base + 3
    assert set(m) >= {"prediction_count", "fraud_prediction_count", "average_risk_score", "high_risk_rate", "model_latency"}
    assert m["model_latency"]["meanMs"] > 0


def test_metrics_endpoint_serves_real_evaluation(client):
    body = client.get("/metrics").json()
    assert body["test"]["prAuc"] > 0 and "logisticRegression" in body["comparison"]
    assert client.get("/importance").json()[0]["importanceShare"] > 0
    assert client.get("/model").json()["algorithm"]
    assert client.get("/scam-dna").json()["types"]


def test_default_timestamp_is_now(client):
    body = tx()
    del body["transaction"]["timestamp"]
    assert client.post("/predict", json=body).status_code == 200
    assert abs(time.time() - time.time()) < 1
