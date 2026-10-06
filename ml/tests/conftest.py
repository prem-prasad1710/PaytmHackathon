import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dataset.generate_dataset import build_dataframe  # noqa: E402
from dataset.simulator import SimConfig, generate_events  # noqa: E402


@pytest.fixture(scope="session")
def small_events():
    return generate_events(SimConfig(seed=7, days=24, n_users=900, n_merchants=60, n_new_legit=120,
                                     target_legit_txns=14_000,
                                     campaigns={"phishing_kyc": 4, "reward_scam": 3, "investment_scam": 3,
                                                "job_scam": 3, "account_takeover": 4, "money_mule": 3}))


@pytest.fixture(scope="session")
def small_df(small_events):
    return build_dataframe(small_events)
