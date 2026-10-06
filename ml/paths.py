from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "dataset" / "raw"
PROCESSED_DIR = ROOT / "dataset" / "processed"
MODELS_DIR = ROOT / "models"
EVAL_DIR = ROOT / "evaluation"
EVENTS_PATH = RAW_DIR / "events.jsonl"
DATASET_PATH = PROCESSED_DIR / "transactions.csv"
