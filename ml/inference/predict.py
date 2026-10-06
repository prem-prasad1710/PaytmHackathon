"""Load a registered fraud model once and score feature vectors.

    from inference.predict import FraudModel
    model = FraudModel()                       # loads models/<active>/ into memory
    out = model.score(feature_dict)            # probability, riskScore, topFactors, ...
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from features.feature_engineering import FEATURE_LABELS  # noqa: E402
from inference.explain import protective_factors, top_factors  # noqa: E402
from paths import MODELS_DIR  # noqa: E402


def signed_log1p(x: np.ndarray) -> np.ndarray:
    return np.sign(x) * np.log1p(np.abs(x))


def active_version(models_dir: Path = MODELS_DIR) -> str:
    registry = models_dir / "registry.json"
    if registry.exists():
        return json.loads(registry.read_text())["active"]
    return "v1"


def _logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


class ModelNotFound(RuntimeError):
    pass


class FraudModel:
    def __init__(self, version: Optional[str] = None, models_dir: Path = MODELS_DIR):
        self.version = version or active_version(models_dir)
        self.dir = Path(models_dir) / self.version
        meta_path = self.dir / "metadata.json"
        if not meta_path.exists():
            raise ModelNotFound(f"No trained model at {self.dir}. Run: npm run train:ml")
        self.metadata: dict = json.loads(meta_path.read_text())
        self.feature_names: List[str] = self.metadata["featureNames"]
        self.threshold: float = float(self.metadata["decisionThreshold"])
        self.algorithm: str = self.metadata["algorithm"]
        self.model_version: str = self.metadata["modelVersion"]
        self.baseline = np.asarray(self.metadata["featureBaseline"], dtype=np.float64)
        self.metrics: dict = json.loads((self.dir / "metrics.json").read_text()) if (self.dir / "metrics.json").exists() else {}

        self._booster = None
        self._sk = None
        if (self.dir / "model.json").exists():
            import xgboost as xgb

            self._booster = xgb.Booster()
            self._booster.load_model(str(self.dir / "model.json"))
        else:
            import joblib

            self._sk = joblib.load(self.dir / "model.joblib")

        dna = self.dir / "scam_dna.json"
        self.dna: Optional[dict] = json.loads(dna.read_text()) if dna.exists() else None

    # ------------------------------------------------------------------ scoring
    def vector(self, features: Dict[str, float]) -> np.ndarray:
        return np.array([[float(features[n]) for n in self.feature_names]], dtype=np.float64)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self._booster is not None:
            import xgboost as xgb

            return self._booster.predict(xgb.DMatrix(X))
        return self._sk.predict_proba(X)[:, 1]

    def contributions(self, X: np.ndarray) -> np.ndarray:
        """Per-feature log-odds contributions, shape (n, n_features).

        XGBoost: exact TreeSHAP values from the booster (pred_contribs).
        Fallback model: occlusion - how far does the log-odds drop when a feature is
        replaced by its training median?
        """
        if self._booster is not None:
            import xgboost as xgb

            return self._booster.predict(xgb.DMatrix(X), pred_contribs=True)[:, :-1]
        base = _logit(self.predict_proba(X))
        out = np.zeros_like(X)
        for j in range(X.shape[1]):
            masked = X.copy()
            masked[:, j] = self.baseline[j]
            out[:, j] = base - _logit(self.predict_proba(masked))
        return out

    def score(self, features: Dict[str, float], explain: bool = True) -> dict:
        X = self.vector(features)
        p = float(self.predict_proba(X)[0])
        result = {
            "fraudProbability": round(p, 4),
            "riskScore": int(round(p * 100)),
            "isFraudPrediction": bool(p >= self.threshold),
            "modelVersion": self.model_version,
            "algorithm": self.algorithm,
            "threshold": self.threshold,
        }
        if explain:
            contribs = self.contributions(X)[0]
            values = X[0]
            result["topFactors"] = top_factors(self.feature_names, values, contribs)
            result["protectiveFactors"] = protective_factors(self.feature_names, values, contribs)
            result["scamDna"] = self.scam_dna(features)
        return result

    # ------------------------------------------------------------------ scam DNA
    def scam_dna(self, features: Dict[str, float], top: int = 3) -> List[dict]:
        """Cosine similarity of this payment to the learned fingerprint of every scam type."""
        if not self.dna:
            return []
        x = signed_log1p(np.array([float(features[n]) for n in self.dna["featureNames"]]))
        z = (x - np.array(self.dna["mean"])) / np.array(self.dna["std"])
        norm = float(np.linalg.norm(z)) or 1.0
        rows = []
        for stype, info in self.dna["types"].items():
            c = np.array(info["centroid"])
            cos = float(np.dot(z, c) / (norm * (float(np.linalg.norm(c)) or 1.0)))
            rows.append({
                "type": stype, "label": info["label"], "similarity": round(max(0.0, cos), 3),
                "signature": info["signature"], "sampleCount": info["count"],
            })
        rows.sort(key=lambda r: -r["similarity"])
        return rows[:top]


__all__ = ["FraudModel", "ModelNotFound", "signed_log1p", "active_version", "FEATURE_LABELS"]
