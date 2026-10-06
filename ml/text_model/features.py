"""Shared feature code for the text classifier and the transaction anomaly model."""
from __future__ import annotations

import math
import re

import numpy as np
from scipy.sparse import hstack

TXN_FEATURES = [
    "amount_ratio",
    "new_payee",
    "night",
    "velocity_1h",
    "payee_complaints",
    "collect_request",
]

TXN_LABELS = {
    "amount_ratio": "Amount is far above your usual payment size",
    "new_payee": "Payee is new / never paid before",
    "night": "Payment is happening late at night",
    "velocity_1h": "Many payments in the last hour",
    "payee_complaints": "Payee has community complaints",
    "collect_request": "This is a collect request, not a normal send",
}


def txn_vector(amount: float, user_avg: float, new_payee: bool, hour: int,
               velocity_1h: int, payee_complaints: int, collect_request: bool) -> np.ndarray:
    ratio = math.log1p(max(amount, 0) / max(user_avg, 1))
    night = 1.0 if (hour >= 23 or hour <= 4) else 0.0
    return np.array(
        [ratio, float(new_payee), night, float(min(velocity_1h, 10)),
         math.log1p(max(payee_complaints, 0)), float(collect_request)],
        dtype=float,
    )


_URL_RE = re.compile(r"(https?://|www\.|bit\.ly|tinyurl|cutt\.ly|rb\.gy|wa\.me)", re.I)
_UPI_RE = re.compile(r"[\w.-]+@[a-z]{2,}", re.I)
_AMT_RE = re.compile(r"(?:₹|rs\.?|inr)\s*\d", re.I)


def stat_features(texts: list[str]) -> np.ndarray:
    """A few cheap handcrafted signals appended to the TF-IDF vectors."""
    rows = []
    for t in texts:
        rows.append([
            1.0 if _URL_RE.search(t) else 0.0,
            1.0 if _UPI_RE.search(t) else 0.0,
            1.0 if _AMT_RE.search(t) else 0.0,
            min(t.count("!"), 5) / 5.0,
            sum(c.isupper() for c in t) / max(len(t), 1),
        ])
    return np.array(rows, dtype=float)


STAT_NAMES = ["contains_link", "contains_upi_id", "mentions_amount", "exclamations", "uppercase_ratio"]


def text_matrix(word_vec, char_vec, texts: list[str]):
    return hstack([word_vec.transform(texts), char_vec.transform(texts), stat_features(texts)]).tocsr()
