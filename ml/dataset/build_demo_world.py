"""Build the deterministic demo world shared by the Node backend and the tests.

    python ml/dataset/build_demo_world.py   ->   shared/fraudDemoWorld.json

The file is a list of ledger events positioned RELATIVE to "now" (relTs <= 0 seconds), so the
scam burst is always "in the last 5 minutes" whenever the demo is loaded. It contains only
raw events: account creations, payments, complaints, blocks. No scores, no probabilities.
The model and the graph/rule engines read this history and decide for themselves.

Three scenario payments are defined (normal / suspicious / scam). The scam one targets
`scammer_demo@upi`: a 3-day-old account on a device shared with 8 accounts (3 already blocked),
that received 43 payments in the last 5 minutes, has 17 complaints against ~55 payments, and
forwards received money onward immediately.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "shared" / "fraudDemoWorld.json"
DAY = 86400.0
rng = np.random.default_rng(2026)

events: list[dict] = []
accounts: list[dict] = []


def account(account_id: str, age_days: float, device: str, ip: str, kind: str, name: str | None = None) -> None:
    events.append({"type": "account_created", "relTs": -age_days * DAY, "account_id": account_id,
                   "device_id": device, "ip_id": ip})
    accounts.append({"id": account_id, "kind": kind, "name": name or account_id})


def pay(rel: float, sender: str, recipient: str, amount: float, device: str, ip: str) -> None:
    events.append({"type": "transaction", "relTs": float(rel), "sender_id": sender, "recipient_id": recipient,
                   "amount": float(round(amount)), "device_id": device, "ip_id": ip})


def complaint(rel: float, account_id: str, reporter: str) -> None:
    events.append({"type": "complaint", "relTs": float(rel), "account_id": account_id, "reporter_id": reporter})


def block(rel: float, account_id: str) -> None:
    events.append({"type": "block", "relTs": float(rel), "account_id": account_id})


# ------------------------------------------------------------------ everyday economy
N_USERS, N_MERCHANTS = 90, 16
merchant_names = ["bigbasket", "swiggy_food", "zomato", "irctc", "bses_power", "airtel_recharge", "jio_recharge", "uber_rides",
                  "amazon_pay", "flipkart", "pharmeasy", "dmart", "cafe_coffee", "metro_card", "gas_booking", "bookmyshow"]
merchants = [f"{n}@upi" for n in merchant_names[:N_MERCHANTS]]
for m in merchants:
    account(m, rng.uniform(300, 1500), f"D_{m}", f"IP_{m}", "merchant")

users = []
for i in range(1, N_USERS + 1):
    uid = f"user_{i:03d}"
    users.append(uid)
    account(uid, rng.uniform(120, 900), f"D_{uid}", f"IP_{uid}", "user", uid)

mu = {u: rng.normal(6.0, 0.7) for u in users}
contacts = {u: list(rng.choice(merchants, 4, replace=False)) + list(rng.choice([x for x in users if x != u], 3, replace=False)) for u in users}
for u in users:
    n = int(rng.integers(14, 24))
    for _ in range(n):
        rel = -rng.uniform(1.5, 20) * DAY
        recipient = contacts[u][int(rng.integers(len(contacts[u])))]
        pay(rel, u, recipient, np.exp(rng.normal(mu[u], 0.6)), f"D_{u}", f"IP_{u}")

# ------------------------------------------------------------------ previously busted scam ring (device D_RING_A)
RING_DEVICE, RING_IP = "D_RING_A", "IP_RING_A"
blocked_ring = ["kyc_helpdesk_01@upi", "kyc_helpdesk_02@upi", "rewards_claim_desk@upi"]
for k, rid in enumerate(blocked_ring):
    account(rid, 14 - k, RING_DEVICE, RING_IP, "blocked_scam")
for k in range(1, 5):
    account(f"helper_mule_{k}@upi", 6, RING_DEVICE, f"IP_mule_{k}", "mule")
account("collector_77@upi", 9, "D_COLLECTOR_77", "IP_COLLECTOR_77", "mule")

victim_cursor = 0
for k, rid in enumerate(blocked_ring):
    for _ in range(int(rng.integers(16, 26))):
        victim = users[victim_cursor % N_USERS]
        victim_cursor += 7
        rel = -rng.uniform(5, 9) * DAY
        pay(rel, victim, rid, 99 + 100 * (k % 2), f"D_{victim}", f"IP_{victim}")
        if rng.random() < 0.45:
            complaint(rel + rng.uniform(3600, 40000), rid, victim)
    for j in range(7):
        complaint(-rng.uniform(2.5, 4.5) * DAY, rid, users[(victim_cursor + j * 5) % N_USERS])
    block(-(2 + k) * DAY, rid)

# ------------------------------------------------------------------ the demo scammer (never blocked yet)
SCAMMER = "scammer_demo@upi"
account(SCAMMER, 3, RING_DEVICE, RING_IP, "scammer", "scammer_demo@upi")
older = users[50:62]
for k, victim in enumerate(older):
    rel = -(1.2 * DAY) + k * 3500
    pay(rel, victim, SCAMMER, 999, f"D_{victim}", f"IP_{victim}")
    complaint(rel + 1800, SCAMMER, victim)
for k in range(43):
    victim = users[k]
    rel = -290 + k * 6.4
    pay(rel, victim, SCAMMER, 999, f"D_{victim}", f"IP_{victim}")
for k in range(5):
    complaint(-200 + k * 20, SCAMMER, users[k])
for k, rel in enumerate([-1500, -900, -600, -330, -150]):
    pay(rel, SCAMMER, "collector_77@upi", 999 * (8 if k < 4 else 6), RING_DEVICE, RING_IP)
for rel in (-40, -30, -20, -10):
    pay(rel, SCAMMER, "collector_77@upi", 4200, RING_DEVICE, RING_IP)

# ------------------------------------------------------------------ a suspicious (but not confirmed) payee
SUSPECT = "quick_loan_desk@upi"
account(SUSPECT, 26, "D_QUICK_LOAN", "IP_QUICK_LOAN", "suspicious")
for k in range(26):
    victim = users[(70 + k * 2) % N_USERS]
    pay(-rng.uniform(1.5, 24) * DAY, victim, SUSPECT, [500, 1500, 2000, 800][k % 4], f"D_{victim}", f"IP_{victim}")
for k in range(5):
    victim = users[20 + k]
    pay(-2700 + k * 420, victim, SUSPECT, [2000, 1500, 2000, 800, 2000][k], f"D_{victim}", f"IP_{victim}")
complaint(-86400 * 2, SUSPECT, users[70])

# ------------------------------------------------------------------ second live scam ring for the simulator
RING_B = "D_RING_B"
account("reward_claim_help@upi", 2, RING_B, "IP_RING_B", "scammer")
account("lucky_draw_kyc@upi", 4, RING_B, "IP_RING_B", "blocked_scam")
account("verify_now_support@upi", 5, RING_B, "IP_RING_B", "blocked_scam")
for rid in ("lucky_draw_kyc@upi", "verify_now_support@upi"):
    for k in range(18):
        victim = users[(30 + k * 3) % N_USERS]
        pay(-rng.uniform(1.5, 3) * DAY, victim, rid, 199, f"D_{victim}", f"IP_{victim}")
    for k in range(6):
        complaint(-rng.uniform(0.5, 1.5) * DAY, rid, users[(31 + k * 4) % N_USERS])
    block(-0.4 * DAY, rid)

events.sort(key=lambda e: e["relTs"])
world = {
    "description": "Deterministic demo ledger. Timestamps are relTs seconds relative to 'now'. Contains events only - no scores.",
    "builtBy": "ml/dataset/build_demo_world.py (seed 2026)",
    "scenarios": {
        "normal": {
            "label": "Normal payment", "story": "Regular user pays a long-established grocery merchant.",
            "transaction": {"senderId": "user_075", "recipientId": "bigbasket@upi", "amount": 1240, "deviceId": "D_user_075", "ipAddress": "IP_user_075"},
        },
        "suspicious": {
            "label": "Suspicious payment", "story": "User pays a 26-day-old 'loan desk' that has attracted a burst of payments in the last hour and one complaint.",
            "transaction": {"senderId": "user_040", "recipientId": SUSPECT, "amount": 2000, "deviceId": "D_user_040", "ipAddress": "IP_user_040"},
        },
        "scam": {
            "label": "Scam payment", "story": "User pays scammer_demo@upi - 3 days old, 43 payments in 5 minutes, 17 complaints, on a device shared with 3 blocked accounts.",
            "transaction": {"senderId": "user_063", "recipientId": SCAMMER, "amount": 999, "deviceId": "D_user_063", "ipAddress": "IP_user_063"},
        },
    },
    "livePools": {
        "users": users,
        "merchants": merchants,
        "suspicious": [SUSPECT],
        "scam": [SCAMMER, "reward_claim_help@upi"],
        "contacts": contacts,
    },
    "accounts": accounts,
    "events": events,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(world, separators=(",", ":")))
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB, {len(events):,} events)", file=sys.stderr)
