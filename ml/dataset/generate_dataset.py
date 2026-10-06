"""Generate the synthetic fraud dataset.

    python ml/dataset/generate_dataset.py [--seed 42] [--days 60]

1. simulate a time-ordered event log          -> dataset/raw/events.jsonl
2. replay it through the shared FeatureStore  -> dataset/processed/transactions.csv
   (features for every payment are computed from state strictly BEFORE that payment)
3. write a dataset report                     -> evaluation/dataset_report.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.metrics import roc_auc_score  # noqa: E402

from dataset.simulator import SimConfig, generate_events  # noqa: E402
from features.feature_engineering import FEATURE_NAMES, replay  # noqa: E402
from paths import DATASET_PATH, EVAL_DIR, EVENTS_PATH, PROCESSED_DIR, RAW_DIR  # noqa: E402

ID_COLUMNS = ["transaction_id", "timestamp", "sender_id", "recipient_id"]
LABEL_COLUMNS = ["is_fraud", "scam_type"]


def build_dataframe(events: list[dict]) -> pd.DataFrame:
    rows = []
    for ev, feats in replay(events):
        if feats is None:
            continue
        row = {
            "transaction_id": ev["transaction_id"], "timestamp": ev["ts"],
            "sender_id": ev["sender_id"], "recipient_id": ev["recipient_id"],
        }
        row.update(feats)
        row["is_fraud"] = int(ev["is_fraud"])
        row["scam_type"] = ev["scam_type"]
        rows.append(row)
    return pd.DataFrame(rows, columns=ID_COLUMNS + FEATURE_NAMES + LABEL_COLUMNS)


def dataset_report(df: pd.DataFrame, config: SimConfig) -> dict:
    y = df["is_fraud"].to_numpy()
    single_auc = {}
    for name in FEATURE_NAMES:
        col = df[name].to_numpy()
        if np.ptp(col) == 0:
            continue
        auc = roc_auc_score(y, col)
        single_auc[name] = round(float(max(auc, 1 - auc)), 4)
    top = dict(sorted(single_auc.items(), key=lambda kv: -kv[1])[:8])
    fraud, legit = df[df.is_fraud == 1], df[df.is_fraud == 0]
    return {
        "generatedWith": {"seed": config.seed, "days": config.days, "users": config.n_users,
                          "merchants": config.n_merchants},
        "rows": int(len(df)),
        "fraudRows": int(y.sum()),
        "fraudRate": round(float(y.mean()), 4),
        "scamTypeCounts": {k: int(v) for k, v in df.scam_type.value_counts().items()},
        "timeRange": {"start": float(df.timestamp.min()), "end": float(df.timestamp.max())},
        "features": len(FEATURE_NAMES),
        "singleFeatureAucTop": top,
        "maxSingleFeatureAuc": max(single_auc.values()),
        "featureMeansLegit": {k: round(float(legit[k].mean()), 3) for k in FEATURE_NAMES},
        "featureMeansFraud": {k: round(float(fraud[k].mean()), 3) for k in FEATURE_NAMES},
        "note": "Synthetic data only. Labels come from the generating campaign, never from features.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--days", type=int, default=60)
    args = parser.parse_args()

    config = SimConfig(seed=args.seed, days=args.days)
    t0 = time.time()
    events = generate_events(config)
    print(f"simulated {len(events):,} events in {time.time() - t0:.1f}s")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    with EVENTS_PATH.open("w") as fh:
        for ev in events:
            fh.write(json.dumps(ev, separators=(",", ":")) + "\n")

    t1 = time.time()
    df = build_dataframe(events)
    print(f"built {len(df):,} feature rows in {time.time() - t1:.1f}s")
    df.to_csv(DATASET_PATH, index=False)

    report = dataset_report(df, config)
    (EVAL_DIR / "dataset_report.json").write_text(json.dumps(report, indent=2))
    print(f"fraud rate {report['fraudRate']:.2%} ({report['fraudRows']:,} fraud / {report['rows']:,})")
    print("scam types:", report["scamTypeCounts"])
    print("strongest single-feature AUCs:", report["singleFeatureAucTop"])
    print(f"wrote {DATASET_PATH}")


if __name__ == "__main__":
    main()
