"""Point-in-time feature engineering - the ONE implementation shared by
dataset generation, training, validation and live inference.

`FeatureStore` holds the account/device/IP/payment graph state. The contract is:

    features = build_transaction_features(tx, store)   # reads state strictly BEFORE tx
    store.apply(tx_event)                              # only then does tx become history

Replaying a time-ordered event log through that two-step loop gives training
rows that contain exactly what a live system would have known at that moment
(no future complaints, no future blocks, no future velocity).

Feature definitions (all "before the transaction"):
  transactions_last_5min/1hr/24hr, amount_last_1hr/24hr
        inbound payments to the RECIPIENT inside the window (excluding this one)
  recipient_transaction_count / unique_senders_to_recipient
        lifetime inbound payments / distinct payers
  recipient_complaint_count / recipient_complaint_rate
        complaints filed so far, and complaints / inbound payments
  unique_devices / unique_ips / sender_device_age / new_device / new_ip
        SENDER-side device and network history (including the one on this request);
        new_device / new_ip = never seen, or first seen less than 24h ago
  device_user_count / ip_user_count / recipient_device_age
        number of accounts sharing the RECIPIENT's device / IP, and device age
  sender_device_user_count
        accounts seen on the device used for this request
  fund_transfer_velocity
        share of what the recipient received in the last hour that it already sent on
  sender_pass_through_ratio
        share of the sender's outgoing money that arrived in the last hour (mule behaviour)
  amount_zscore / velocity_zscore
        deviation from the sender's own history (log-amount z, Poisson-rate z)
  same_amount_ratio
        fraction of recent inbound payments with exactly this amount (repeated-amount scams)
  sender_prior_payments_to_recipient / amount_growth_vs_prior
        history between this pair (escalating amounts)
  graph_* / connected_* / distance_to_blocked_entity
        see features/graph.py
"""
from __future__ import annotations

import math
from collections import deque
from typing import Dict, Iterable, Iterator, List, Optional, Tuple

from features.graph import NO_BLOCKED_DISTANCE, graph_features

DAY = 86400.0
IST_OFFSET = 19800
TIME_CAP = 30 * DAY
WINDOW_5M, WINDOW_1H, WINDOW_24H = 300.0, 3600.0, DAY
LOG_PRIOR_MEAN, LOG_PRIOR_VAR, PRIOR_N = math.log1p(500.0), 1.2 ** 2, 3

FEATURE_NAMES: List[str] = [
    "amount",
    "sender_account_age_days",
    "recipient_account_age_days",
    "transactions_last_5min",
    "transactions_last_1hr",
    "transactions_last_24hr",
    "amount_last_1hr",
    "amount_last_24hr",
    "recipient_transaction_count",
    "recipient_complaint_count",
    "recipient_complaint_rate",
    "unique_senders_to_recipient",
    "unique_devices",
    "unique_ips",
    "sender_device_age",
    "recipient_device_age",
    "device_user_count",
    "ip_user_count",
    "sender_device_user_count",
    "time_since_last_transaction",
    "fund_transfer_velocity",
    "sender_pass_through_ratio",
    "new_recipient",
    "new_device",
    "new_ip",
    "hour_of_day",
    "day_of_week",
    "graph_degree",
    "graph_risk_score",
    "connected_blocked_accounts",
    "connected_scam_accounts",
    "connected_victims",
    "distance_to_blocked_entity",
    "amount_zscore",
    "velocity_zscore",
    "sender_transactions_last_1hr",
    "same_amount_ratio",
    "sender_prior_payments_to_recipient",
    "amount_growth_vs_prior",
]

FEATURE_LABELS: Dict[str, str] = {
    "amount": "Payment amount",
    "sender_account_age_days": "Sender account age",
    "recipient_account_age_days": "Recipient account age",
    "transactions_last_5min": "Payments received in last 5 minutes",
    "transactions_last_1hr": "Payments received in last hour",
    "transactions_last_24hr": "Payments received in last 24 hours",
    "amount_last_1hr": "Money received in last hour",
    "amount_last_24hr": "Money received in last 24 hours",
    "recipient_transaction_count": "Recipient payment history",
    "recipient_complaint_count": "Complaints against recipient",
    "recipient_complaint_rate": "Recipient complaint rate",
    "unique_senders_to_recipient": "Distinct people paying recipient",
    "unique_devices": "Devices used by sender",
    "unique_ips": "Networks used by sender",
    "sender_device_age": "Sender device age",
    "recipient_device_age": "Recipient device age",
    "device_user_count": "Accounts sharing recipient's device",
    "ip_user_count": "Accounts sharing recipient's network",
    "sender_device_user_count": "Accounts on sender's device",
    "time_since_last_transaction": "Time since sender's last payment",
    "fund_transfer_velocity": "Rapid fund movement",
    "sender_pass_through_ratio": "Sender forwarding funds just received",
    "new_recipient": "First payment to this recipient",
    "new_device": "Unrecognised device",
    "new_ip": "Unrecognised network",
    "hour_of_day": "Time of day",
    "day_of_week": "Day of week",
    "graph_degree": "Network connections",
    "graph_risk_score": "Graph risk",
    "connected_blocked_accounts": "Connected blocked accounts",
    "connected_scam_accounts": "Connected flagged accounts",
    "connected_victims": "Connected victims",
    "distance_to_blocked_entity": "Distance to blocked account",
    "amount_zscore": "Unusual amount for sender",
    "velocity_zscore": "Unusual payment speed for sender",
    "sender_transactions_last_1hr": "Sender payments in last hour",
    "same_amount_ratio": "Repeated identical amounts",
    "sender_prior_payments_to_recipient": "Earlier payments to recipient",
    "amount_growth_vs_prior": "Amount escalation to recipient",
}


class Account:
    __slots__ = (
        "created_ts", "devices", "ips", "last_device", "last_ip", "in_ev", "out_ev",
        "n_in", "n_out", "senders", "complaints", "reporters", "blocked_ts", "first_tx_ts",
        "last_tx_ts", "log_n", "log_sum", "log_m2", "contacts", "adj", "out_adj",
    )

    def __init__(self, created_ts: float):
        self.created_ts = created_ts
        self.devices: Dict[str, float] = {}
        self.ips: Dict[str, float] = {}
        self.last_device: Optional[str] = None
        self.last_ip: Optional[str] = None
        self.in_ev: deque = deque()     # (ts, amount, sender_id)
        self.out_ev: deque = deque()    # (ts, amount)
        self.n_in = 0
        self.n_out = 0
        self.senders: set = set()
        self.complaints = 0
        self.reporters: set = set()
        self.blocked_ts: Optional[float] = None
        self.first_tx_ts: Optional[float] = None
        self.last_tx_ts: Optional[float] = None
        self.log_n = 0
        self.log_sum = 0.0
        self.log_m2 = 0.0
        self.contacts: Dict[str, Tuple[int, float]] = {}
        self.adj: Dict[str, None] = {}       # every counterparty, either direction
        self.out_adj: Dict[str, None] = {}   # accounts this account has paid


class FeatureStore:
    """Mutable, event-sourced state. Events must be applied in time order."""

    def __init__(self) -> None:
        self.accounts: Dict[str, Account] = {}
        self.device_users: Dict[str, set] = {}
        self.ip_users: Dict[str, set] = {}
        self.event_count = 0
        self.last_ts = 0.0

    # ------------------------------------------------------------------ state updates
    def apply(self, event: dict) -> None:
        kind = event["type"]
        if kind == "transaction":
            self._apply_transaction(event)
        elif kind == "account_created":
            self._apply_account(event)
        elif kind == "complaint":
            self._apply_complaint(event)
        elif kind == "block":
            self._apply_block(event)
        else:
            raise ValueError(f"unknown event type: {kind!r}")
        self.event_count += 1
        self.last_ts = max(self.last_ts, float(event["ts"]))

    def _ensure(self, account_id: str, ts: float) -> Account:
        acct = self.accounts.get(account_id)
        if acct is None:
            acct = self.accounts[account_id] = Account(ts)
        return acct

    def _register_infra(self, acct: Account, account_id: str, device: Optional[str], ip: Optional[str], ts: float) -> None:
        if device:
            if device not in acct.devices:
                acct.devices[device] = ts
            acct.last_device = device
            self.device_users.setdefault(device, set()).add(account_id)
        if ip:
            if ip not in acct.ips:
                acct.ips[ip] = ts
            acct.last_ip = ip
            self.ip_users.setdefault(ip, set()).add(account_id)

    def _apply_account(self, ev: dict) -> None:
        ts = float(ev["ts"])
        acct = self._ensure(ev["account_id"], ts)
        acct.created_ts = min(acct.created_ts, ts)
        self._register_infra(acct, ev["account_id"], ev.get("device_id"), ev.get("ip_id"), ts)

    def _apply_complaint(self, ev: dict) -> None:
        acct = self._ensure(ev["account_id"], float(ev["ts"]))
        acct.complaints += 1
        if ev.get("reporter_id"):
            acct.reporters.add(ev["reporter_id"])

    def _apply_block(self, ev: dict) -> None:
        acct = self._ensure(ev["account_id"], float(ev["ts"]))
        if acct.blocked_ts is None:
            acct.blocked_ts = float(ev["ts"])

    def _apply_transaction(self, tx: dict) -> None:
        ts = float(tx["ts"])
        amount = float(tx["amount"])
        sid, rid = tx["sender_id"], tx["recipient_id"]
        s = self._ensure(sid, ts)
        r = self._ensure(rid, ts)
        self._register_infra(s, sid, tx.get("device_id"), tx.get("ip_id"), ts)

        x = math.log1p(amount)
        s.log_n += 1
        delta = x - (s.log_sum / (s.log_n - 1) if s.log_n > 1 else x)
        s.log_sum += x
        s.log_m2 += delta * (x - s.log_sum / s.log_n)

        if s.first_tx_ts is None:
            s.first_tx_ts = ts
        s.last_tx_ts = ts
        s.n_out += 1
        s.out_ev.append((ts, amount))
        count, _ = s.contacts.get(rid, (0, 0.0))
        s.contacts[rid] = (count + 1, amount)

        r.n_in += 1
        r.senders.add(sid)
        r.in_ev.append((ts, amount, sid))

        s.out_adj.pop(rid, None)
        s.out_adj[rid] = None
        s.adj.pop(rid, None)
        s.adj[rid] = None
        r.adj.pop(sid, None)
        r.adj[sid] = None

        horizon = ts - DAY
        for acct in (s, r):
            while acct.in_ev and acct.in_ev[0][0] < horizon:
                acct.in_ev.popleft()
            while acct.out_ev and acct.out_ev[0][0] < horizon:
                acct.out_ev.popleft()

    # ------------------------------------------------------------------ helpers for features
    @staticmethod
    def _window_in(acct: Account, now: float) -> Tuple[int, int, int, float, float]:
        c5 = c1h = c24 = 0
        a1h = a24 = 0.0
        for ts, amt, _ in reversed(acct.in_ev):
            age = now - ts
            if age > WINDOW_24H:
                break
            c24 += 1
            a24 += amt
            if age <= WINDOW_1H:
                c1h += 1
                a1h += amt
                if age <= WINDOW_5M:
                    c5 += 1
        return c5, c1h, c24, a1h, a24

    @staticmethod
    def _window_out(acct: Account, now: float, window: float) -> Tuple[int, float]:
        n, total = 0, 0.0
        for ts, amt in reversed(acct.out_ev):
            if now - ts > window:
                break
            n += 1
            total += amt
        return n, total

    def stats(self) -> dict:
        blocked = sum(1 for a in self.accounts.values() if a.blocked_ts is not None)
        return {
            "accounts": len(self.accounts),
            "devices": len(self.device_users),
            "events": self.event_count,
            "blockedAccounts": blocked,
            "lastEventTs": self.last_ts,
        }


def validate_transaction(tx: dict) -> dict:
    """Normalise a raw transaction and reject malformed input with ValueError."""
    if not isinstance(tx, dict):
        raise ValueError("transaction must be an object")
    for key in ("sender_id", "recipient_id"):
        val = tx.get(key)
        if not isinstance(val, str) or not val.strip():
            raise ValueError(f"{key} is required")
    try:
        amount = float(tx.get("amount"))
        ts = float(tx.get("ts"))
    except (TypeError, ValueError):
        raise ValueError("amount and ts must be numbers") from None
    if not math.isfinite(amount) or amount <= 0:
        raise ValueError("amount must be a positive number")
    if not math.isfinite(ts) or ts < 0:
        raise ValueError("ts must be a valid epoch timestamp")
    if tx["sender_id"] == tx["recipient_id"]:
        raise ValueError("sender and recipient must differ")
    out = dict(tx)
    out["amount"], out["ts"] = amount, ts
    out["device_id"] = tx.get("device_id") or None
    out["ip_id"] = tx.get("ip_id") or None
    return out


def build_transaction_features(tx: dict, store: FeatureStore) -> Dict[str, float]:
    """Compute the model's feature vector for `tx` from state strictly before `tx`.

    `tx` keys: ts, sender_id, recipient_id, amount, device_id (optional), ip_id (optional).
    Unknown accounts are treated as brand-new, history-less accounts.
    """
    tx = validate_transaction(tx)
    now, amount = tx["ts"], tx["amount"]
    sid, rid = tx["sender_id"], tx["recipient_id"]
    dev, ip = tx["device_id"], tx["ip_id"]
    s = store.accounts.get(sid)
    r = store.accounts.get(rid)
    local = now + IST_OFFSET

    f: Dict[str, float] = {"amount": amount}
    f["sender_account_age_days"] = max(0.0, (now - s.created_ts) / DAY) if s else 0.0
    f["recipient_account_age_days"] = max(0.0, (now - r.created_ts) / DAY) if r else 0.0

    if r:
        c5, c1h, c24, a1h, a24 = store._window_in(r, now)
        out_n, out_amt = store._window_out(r, now, WINDOW_1H)
        recent: List[float] = []
        for ts_i, amt_i, _ in reversed(r.in_ev):
            if len(recent) >= 50 or now - ts_i > WINDOW_24H:
                break
            recent.append(amt_i)
        same = sum(1 for a in recent if abs(a - amount) < 0.5)
        f["same_amount_ratio"] = same / len(recent) if recent else 0.0
        f["fund_transfer_velocity"] = min(1.5, out_amt / a1h) if a1h > 0 else 0.0
        f["recipient_transaction_count"] = r.n_in
        f["recipient_complaint_count"] = r.complaints
        f["recipient_complaint_rate"] = min(1.0, r.complaints / max(r.n_in, 1))
        f["unique_senders_to_recipient"] = len(r.senders)
        f["recipient_device_age"] = (
            max(0.0, (now - r.devices[r.last_device]) / DAY) if r.last_device else 0.0
        )
        f["device_user_count"] = len(store.device_users.get(r.last_device, ())) if r.last_device else 0
        f["ip_user_count"] = len(store.ip_users.get(r.last_ip, ())) if r.last_ip else 0
    else:
        c5 = c1h = c24 = 0
        a1h = a24 = 0.0
        for k in ("same_amount_ratio", "fund_transfer_velocity", "recipient_transaction_count",
                  "recipient_complaint_count", "recipient_complaint_rate",
                  "unique_senders_to_recipient", "recipient_device_age",
                  "device_user_count", "ip_user_count"):
            f[k] = 0.0
    f["transactions_last_5min"], f["transactions_last_1hr"], f["transactions_last_24hr"] = c5, c1h, c24
    f["amount_last_1hr"], f["amount_last_24hr"] = a1h, a24

    if s:
        unseen_dev = bool(dev) and dev not in s.devices
        unseen_ip = bool(ip) and ip not in s.ips
        f["new_device"] = float(bool(dev) and (unseen_dev or now - s.devices[dev] < DAY))
        f["new_ip"] = float(bool(ip) and (unseen_ip or now - s.ips[ip] < DAY))
        f["unique_devices"] = len(s.devices) + (1 if unseen_dev else 0)
        f["unique_ips"] = len(s.ips) + (1 if unseen_ip else 0)
        f["sender_device_age"] = (
            max(0.0, (now - s.devices[dev]) / DAY) if dev and dev in s.devices else 0.0
        )
        users = store.device_users.get(dev, set()) if dev else set()
        f["sender_device_user_count"] = len(users | {sid}) if dev else 0
        f["time_since_last_transaction"] = (
            min(TIME_CAP, now - s.last_tx_ts) if s.last_tx_ts is not None else TIME_CAP
        )
        s1h_n, s1h_amt = store._window_out(s, now, WINDOW_1H)
        in_1h = sum(a for ts, a, _ in reversed(s.in_ev) if now - ts <= WINDOW_1H)
        total_out = s1h_amt + amount
        f["sender_pass_through_ratio"] = min(in_1h, total_out) / total_out
        f["sender_transactions_last_1hr"] = s1h_n

        n = s.log_n
        mean = (s.log_sum + PRIOR_N * LOG_PRIOR_MEAN) / (n + PRIOR_N)
        var = (s.log_m2 + PRIOR_N * LOG_PRIOR_VAR) / (n + PRIOR_N)
        f["amount_zscore"] = (math.log1p(amount) - mean) / max(0.4, math.sqrt(var))

        history_days = min(30.0, max(1.0, (now - s.first_tx_ts) / DAY)) if s.first_tx_ts is not None else 1.0
        expected = max(0.02, (s.n_out / history_days) / 24.0) if s.n_out else 0.05
        f["velocity_zscore"] = (s1h_n + 1 - expected) / math.sqrt(expected + 0.25)

        prior, last_amt = s.contacts.get(rid, (0, 0.0))
        f["new_recipient"] = float(prior == 0)
        f["sender_prior_payments_to_recipient"] = prior
        f["amount_growth_vs_prior"] = min(20.0, amount / last_amt) if prior and last_amt > 0 else 1.0
    else:
        f.update({
            "new_device": 0.0, "new_ip": 0.0, "unique_devices": 1.0, "unique_ips": 1.0,
            "sender_device_age": 0.0, "sender_device_user_count": 1.0 if dev else 0.0,
            "time_since_last_transaction": TIME_CAP, "sender_pass_through_ratio": 0.0,
            "sender_transactions_last_1hr": 0, "amount_zscore": 0.0,
            "velocity_zscore": 0.0, "new_recipient": 1.0,
            "sender_prior_payments_to_recipient": 0, "amount_growth_vs_prior": 1.0,
        })

    f["hour_of_day"] = int((local // 3600) % 24)
    f["day_of_week"] = int((local // DAY + 3) % 7)

    g = graph_features(store, rid)
    for key in ("graph_degree", "graph_risk_score", "connected_blocked_accounts",
                "connected_scam_accounts", "connected_victims", "distance_to_blocked_entity"):
        f[key] = g[key]

    return {name: float(f[name]) for name in FEATURE_NAMES}


def replay(events: Iterable[dict], store: Optional[FeatureStore] = None) -> Iterator[Tuple[dict, Optional[Dict[str, float]]]]:
    """Walk a time-ordered event log. For every transaction yield its features computed
    BEFORE the transaction is applied; for other events yield (event, None)."""
    store = store or FeatureStore()
    for ev in events:
        feats = build_transaction_features(ev, store) if ev["type"] == "transaction" else None
        yield ev, feats
        store.apply(ev)


__all__ = [
    "FEATURE_NAMES", "FEATURE_LABELS", "FeatureStore", "NO_BLOCKED_DISTANCE",
    "build_transaction_features", "replay", "validate_transaction",
]
