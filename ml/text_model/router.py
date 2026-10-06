"""Message/text scam classifier + payment-behaviour anomaly model.

Mounted by inference/model_service.py under the `/text` prefix:
    GET  /text/health
    GET  /text/metrics
    POST /text/predict       {text} -> scam probability, category, per-token explanation
    POST /text/transaction   payment context -> anomaly score + reasons

Artifacts are loaded lazily so the fraud-transaction service still starts if
this model has not been trained yet.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path

import joblib
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from text_model.features import STAT_NAMES, TXN_FEATURES, TXN_LABELS, stat_features, text_matrix, txn_vector

ART = Path(__file__).parent / "artifacts"
CATEGORY_CONF_MIN = 0.45
STOPWORDS = {
    "a", "an", "the", "and", "or", "on", "in", "of", "to", "for", "is", "are", "at", "by", "it", "this",
    "that", "your", "you", "me", "my", "i", "we", "be", "with", "as", "ko", "ka", "ki", "ke", "se", "hai",
    "hain", "par", "ho", "kar", "karein", "aur", "no", "not",
}
CATEGORY_LABELS = {
    "kyc_phishing": "KYC / account-block phishing",
    "qr_scam": "QR / collect-request scam",
    "lottery_prize": "Lottery / prize fee scam",
    "refund_scam": "Refund / wrong-transfer scam",
    "otp_pin_theft": "OTP / PIN theft",
    "job_fee_scam": "Job / task fee scam",
    "impersonation_police": "Police / authority impersonation",
    "emergency_family": "Fake family emergency",
    "remote_access": "Remote-access app scam",
    "marketplace_advance": "Marketplace advance scam",
    "fake_customer_care": "Fake customer care",
    "electricity_disconnect": "Electricity disconnection scam",
}

router = APIRouter(prefix="/text", tags=["text-model"])


class _Models:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.loaded = False
        self.text = self.anom = self.metrics = None

    def ensure(self):
        if self.loaded:
            return
        with self._lock:
            if self.loaded:
                return
            if not (ART / "text_model.joblib").exists():
                raise HTTPException(503, "Text model not trained. Run: python text_model/train.py")
            self.text = joblib.load(ART / "text_model.joblib")
            self.anom = joblib.load(ART / "anomaly_model.joblib")
            self.metrics = json.loads((ART / "metrics.json").read_text())
            self.word_names = self.text["word"].get_feature_names_out()
            self.word_n = len(self.word_names)
            self.char_n = len(self.text["char"].get_feature_names_out())
            self.loaded = True


M = _Models()


class PredictIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class TxnIn(BaseModel):
    amount: float = Field(ge=0)
    user_avg: float = Field(default=1000, gt=0)
    new_payee: bool = False
    hour: int = Field(default=12, ge=0, le=23)
    velocity_1h: int = Field(default=0, ge=0)
    payee_complaints: int = Field(default=0, ge=0)
    collect_request: bool = False


@router.get("/health")
def health():
    available = (ART / "text_model.joblib").exists()
    return {"ok": available, "model": "tfidf-logreg-v1", "anomaly": "isolation-forest-v1"}


@router.get("/metrics")
def metrics():
    M.ensure()
    return M.metrics


@router.post("/predict")
def predict(body: PredictIn):
    M.ensure()
    text = body.text.strip()
    X = text_matrix(M.text["word"], M.text["char"], [text])
    clf = M.text["binary"]
    prob = float(clf.predict_proba(X)[0, 1])

    contrib = X.toarray()[0] * clf.coef_[0]
    word_contrib = contrib[: M.word_n]
    stat_contrib = contrib[M.word_n + M.char_n:]

    def meaningful(i: int) -> bool:
        return not all(p in STOPWORDS for p in str(M.word_names[i]).split())

    order = [i for i in np.argsort(word_contrib) if meaningful(i)]
    top_scam = [
        {"token": str(M.word_names[i]), "weight": round(float(word_contrib[i]), 3)}
        for i in order[::-1][:10] if word_contrib[i] > 0.02
    ]
    top_safe = [
        {"token": str(M.word_names[i]), "weight": round(float(word_contrib[i]), 3)}
        for i in order[:5] if word_contrib[i] < -0.02
    ]
    raw_stats = stat_features([text])[0]
    signals = [
        {"name": n, "value": round(float(v), 3), "weight": round(float(w), 3)}
        for n, v, w in zip(STAT_NAMES, raw_stats, stat_contrib) if abs(w) > 0.02
    ]

    category = None
    category_confidence = None
    if prob >= 0.4:
        cat_probs = M.text["category"].predict_proba(X)[0]
        j = int(np.argmax(cat_probs))
        if cat_probs[j] >= CATEGORY_CONF_MIN:
            key = str(M.text["category"].classes_[j])
            category = {"id": key, "label": CATEGORY_LABELS.get(key, key)}
            category_confidence = round(float(cat_probs[j]), 3)

    return {
        "scam_probability": round(prob, 4),
        "label": "scam" if prob >= 0.5 else "legit",
        "category": category,
        "category_confidence": category_confidence,
        "top_tokens": top_scam,
        "safe_tokens": top_safe,
        "signals": signals,
        "model": "tfidf-logreg-v1",
    }


@router.post("/transaction")
def transaction(body: TxnIn):
    M.ensure()
    vec = txn_vector(body.amount, body.user_avg, body.new_payee, body.hour,
                     body.velocity_1h, body.payee_complaints, body.collect_request)
    raw = float(-M.anom["iso"].score_samples(vec.reshape(1, -1))[0])
    percentile = float((M.anom["normal_scores"] < raw).mean() * 100)
    z = (vec - M.anom["mean"]) / M.anom["std"]
    reasons = [
        {"feature": f, "text": TXN_LABELS[f], "z": round(float(zi), 2)}
        for f, zi in sorted(zip(TXN_FEATURES, z), key=lambda p: -p[1]) if zi > 1.5
    ][:4]
    return {
        "anomaly_score": round(percentile, 1),
        "level": "high" if percentile >= 97 else "elevated" if percentile >= 85 else "normal",
        "reasons": reasons,
        "model": "isolation-forest-v1",
    }
