"""Scam Shield ML service (FastAPI).

    python ml/inference/model_service.py            # or: npm run dev:ml
    uvicorn inference.model_service:app --port 8001

Fraud layer
    GET  /health            liveness + model/state summary
    POST /predict           transaction -> fraudProbability, riskScore, topFactors, scamDna
    POST /ingest            apply ledger events (accounts, payments, complaints, blocks)
    POST /state/reset       clear the in-memory ledger (used for resync)
    GET  /state             ledger size
    GET  /model             registered model metadata
    GET  /metrics           evaluation metrics produced at training time (+ baseline comparison)
    GET  /importance        feature importance
    GET  /monitoring        prediction_count, fraud_prediction_count, average_risk_score, ...
    GET  /scam-dna          learned fingerprint of each scam type
Message/text model (existing, mounted under /text)
    POST /text/predict, POST /text/transaction, GET /text/metrics, GET /text/health

The model is loaded once at start-up. Features are computed by the same
`build_transaction_features` used for training, from an in-memory FeatureStore.
"""
from __future__ import annotations

import json
import math
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from pydantic import BaseModel, Field, field_validator, model_validator  # noqa: E402

from features.feature_engineering import FeatureStore, build_transaction_features  # noqa: E402
from inference.predict import FraudModel, ModelNotFound  # noqa: E402
from paths import EVAL_DIR  # noqa: E402
from text_model.router import router as text_router  # noqa: E402

HIGH_RISK_SCORE = 70


class Monitoring:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.started = time.time()
        self.reset()

    def reset(self) -> None:
        self.count = 0
        self.fraud = 0
        self.high = 0
        self.score_sum = 0.0
        self.latencies: List[float] = []

    def record(self, risk_score: int, is_fraud: bool, latency_ms: float) -> None:
        with self.lock:
            self.count += 1
            self.fraud += int(is_fraud)
            self.high += int(risk_score >= HIGH_RISK_SCORE)
            self.score_sum += risk_score
            self.latencies.append(latency_ms)
            if len(self.latencies) > 5000:
                self.latencies = self.latencies[-2500:]

    def snapshot(self) -> dict:
        with self.lock:
            lat = self.latencies
            return {
                "prediction_count": self.count,
                "fraud_prediction_count": self.fraud,
                "average_risk_score": round(self.score_sum / self.count, 2) if self.count else 0.0,
                "high_risk_rate": round(self.high / self.count, 4) if self.count else 0.0,
                "model_latency": {
                    "meanMs": round(float(np.mean(lat)), 2) if lat else 0.0,
                    "p95Ms": round(float(np.percentile(lat, 95)), 2) if lat else 0.0,
                    "lastMs": round(lat[-1], 2) if lat else 0.0,
                },
                "uptimeSeconds": int(time.time() - self.started),
            }


class Runtime:
    model: Optional[FraudModel] = None
    load_error: Optional[str] = None
    store = FeatureStore()
    store_lock = threading.RLock()
    monitoring = Monitoring()

    @classmethod
    def load(cls) -> None:
        try:
            cls.model = FraudModel()
            cls.load_error = None
        except ModelNotFound as exc:
            cls.model, cls.load_error = None, str(exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Runtime.load()
    yield


app = FastAPI(title="Scam Shield ML", version="2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(text_router)


# --------------------------------------------------------------------------- schemas
class TransactionIn(BaseModel):
    transactionId: Optional[str] = Field(default=None, max_length=64)
    amount: float = Field(gt=0, allow_inf_nan=False, le=1e9)
    senderId: str = Field(min_length=1, max_length=128)
    recipientId: str = Field(min_length=1, max_length=128)
    deviceId: Optional[str] = Field(default=None, max_length=128)
    ipAddress: Optional[str] = Field(default=None, max_length=128)
    timestamp: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def _distinct_parties(self) -> "TransactionIn":
        if self.senderId == self.recipientId:
            raise ValueError("senderId and recipientId must differ")
        return self


class PredictIn(BaseModel):
    transaction: TransactionIn
    commit: bool = False


class EventsIn(BaseModel):
    events: List[Dict[str, Any]] = Field(max_length=20000)

    @field_validator("events")
    @classmethod
    def _check(cls, events):
        for ev in events:
            if ev.get("type") not in {"account_created", "transaction", "complaint", "block"}:
                raise ValueError(f"unknown event type {ev.get('type')!r}")
            if not isinstance(ev.get("ts"), (int, float)) or not math.isfinite(ev["ts"]):
                raise ValueError("every event needs a numeric ts")
        return events


def to_internal(t: TransactionIn) -> dict:
    return {
        "ts": t.timestamp if t.timestamp is not None else time.time(),
        "sender_id": t.senderId, "recipient_id": t.recipientId, "amount": t.amount,
        "device_id": t.deviceId, "ip_id": t.ipAddress, "transaction_id": t.transactionId,
    }


def require_model() -> FraudModel:
    if Runtime.model is None:
        raise HTTPException(503, Runtime.load_error or "Model not loaded")
    return Runtime.model


# --------------------------------------------------------------------------- routes
@app.get("/health")
def health():
    m = Runtime.model
    return {
        "ok": m is not None,
        "service": "scam-shield-ml",
        "mlAvailable": m is not None,
        "modelVersion": m.model_version if m else None,
        "algorithm": m.algorithm if m else None,
        "error": None if m else Runtime.load_error,
        "ledger": Runtime.store.stats(),
    }


@app.post("/predict")
def predict(body: PredictIn):
    model = require_model()
    tx = to_internal(body.transaction)
    t0 = time.perf_counter()
    try:
        with Runtime.store_lock:
            features = build_transaction_features(tx, Runtime.store)
            result = model.score(features)
            if body.commit:
                Runtime.store.apply({"type": "transaction", **tx})
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    latency = (time.perf_counter() - t0) * 1000
    Runtime.monitoring.record(result["riskScore"], result["isFraudPrediction"], latency)
    return {
        **result,
        "explanation": [f["text"] for f in result["topFactors"]],
        "features": {k: round(v, 4) for k, v in features.items()},
        "mlAvailable": True,
        "latencyMs": round(latency, 2),
        "committed": body.commit,
        "ledgerEvents": Runtime.store.event_count,
    }


@app.post("/ingest")
def ingest(body: EventsIn):
    applied = 0
    with Runtime.store_lock:
        for ev in sorted(body.events, key=lambda e: e["ts"]):
            try:
                Runtime.store.apply(ev)
            except (KeyError, ValueError) as exc:
                raise HTTPException(422, f"bad event: {exc}") from exc
            applied += 1
        stats = Runtime.store.stats()
    return {"applied": applied, "ledger": stats}


@app.post("/state/reset")
def reset_state():
    with Runtime.store_lock:
        Runtime.store = FeatureStore()
    Runtime.monitoring.reset()
    return {"ok": True, "ledger": Runtime.store.stats()}


@app.get("/state")
def state():
    return Runtime.store.stats()


@app.get("/model")
def model_info():
    m = require_model()
    meta = {k: v for k, v in m.metadata.items() if k != "featureBaseline"}
    registry = EVAL_DIR.parent / "models" / "registry.json"
    meta["registry"] = json.loads(registry.read_text()) if registry.exists() else None
    return meta


def _read_eval(name: str):
    path = EVAL_DIR / name
    if not path.exists():
        raise HTTPException(404, f"{name} not found. Run: npm run train:ml")
    return json.loads(path.read_text())


@app.get("/metrics")
def metrics():
    require_model()
    data = _read_eval("metrics.json")
    cv = EVAL_DIR / "cross_validation.json"
    data["crossValidation"] = json.loads(cv.read_text()) if cv.exists() else None
    report = EVAL_DIR / "dataset_report.json"
    if report.exists():
        r = json.loads(report.read_text())
        data["dataset"] = {k: r[k] for k in ("rows", "fraudRows", "fraudRate", "scamTypeCounts", "features", "note")}
    return data


@app.get("/importance")
def importance():
    require_model()
    return _read_eval("feature_importance.json")


@app.get("/monitoring")
def monitoring():
    return Runtime.monitoring.snapshot()


@app.get("/scam-dna")
def scam_dna():
    m = require_model()
    if not m.dna:
        raise HTTPException(404, "scam DNA not available")
    return {"method": m.dna["method"], "types": {
        k: {"label": v["label"], "count": v["count"], "signature": v["signature"]} for k, v in m.dna["types"].items()}}


@app.exception_handler(Exception)
async def unhandled(_request, exc: Exception):  # pragma: no cover - last-resort guard
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


if __name__ == "__main__":
    import os

    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("ML_PORT", "8001")))
