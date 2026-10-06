"""Turn raw model contributions into human-readable risk factors."""
from __future__ import annotations

from typing import Dict, List, Sequence

from features.feature_engineering import FEATURE_LABELS

HIGH_LOGIT = 1.0
MEDIUM_LOGIT = 0.35
MIN_LOGIT = 0.05


def _plural(n: float, word: str) -> str:
    n = int(round(n))
    return f"{n} {word}{'' if n == 1 else 's'}"


def describe(feature: str, v: float) -> str:
    """Plain-language statement of a feature value (worded neutrally; its role comes from the contribution sign)."""
    pct = lambda x: f"{x * 100:.0f}%"  # noqa: E731
    table = {
        "transactions_last_5min": lambda: f"Recipient received {_plural(v, 'payment')} in the last 5 minutes",
        "transactions_last_1hr": lambda: f"Recipient received {_plural(v, 'payment')} in the last hour",
        "transactions_last_24hr": lambda: f"Recipient received {_plural(v, 'payment')} in the last 24 hours",
        "amount_last_1hr": lambda: f"Recipient collected ₹{v:,.0f} in the last hour",
        "amount_last_24hr": lambda: f"Recipient collected ₹{v:,.0f} in the last 24 hours",
        "recipient_account_age_days": lambda: "Recipient account was created today" if v < 1 else f"Recipient account is {_plural(v, 'day')} old",
        "sender_account_age_days": lambda: f"Sender account is {_plural(v, 'day')} old",
        "recipient_complaint_count": lambda: f"{_plural(v, 'complaint')} filed against this recipient",
        "recipient_complaint_rate": lambda: f"{pct(v)} of payments to this recipient were reported as scams",
        "recipient_transaction_count": lambda: f"Recipient has {_plural(v, 'payment')} of history",
        "unique_senders_to_recipient": lambda: f"{_plural(v, 'different person')} have paid this recipient",
        "connected_blocked_accounts": lambda: f"Connected to {_plural(v, 'blocked account')}",
        "connected_scam_accounts": lambda: f"Connected to {_plural(v, 'flagged account')}",
        "connected_victims": lambda: f"{_plural(v, 'reported victim')} linked to this network",
        "distance_to_blocked_entity": lambda: ("Recipient is a blocked account" if v == 0 else "No blocked account within 3 hops" if v > 3 else f"Recipient is {_plural(v, 'hop')} from a blocked account"),
        "graph_risk_score": lambda: f"Graph risk score is {v:.0f}/100",
        "graph_degree": lambda: (f"Recipient has almost no network history ({_plural(v, 'connection')})" if v < 10
                                 else f"Recipient has an unusual connection pattern ({_plural(v, 'connection')})"),
        "sender_device_age": lambda: ("Sender's device has no history" if v < 1 else f"Sender's device is {_plural(v, 'day')} old"),
        "device_user_count": lambda: f"Recipient's device is shared by {_plural(v, 'account')}",
        "ip_user_count": lambda: f"Recipient's network is shared by {_plural(v, 'account')}",
        "recipient_device_age": lambda: f"Recipient's device was first seen {_plural(v, 'day')} ago",
        "sender_device_user_count": lambda: f"Payment device is shared by {_plural(v, 'account')}",
        "fund_transfer_velocity": lambda: f"Recipient forwards {pct(min(v, 1))} of incoming money within the hour",
        "sender_pass_through_ratio": lambda: "Sender is forwarding money that just arrived",
        "new_recipient": lambda: "First payment to this recipient",
        "new_device": lambda: "Payment is from an unrecognised device",
        "new_ip": lambda: "Payment is from an unrecognised network",
        "unique_devices": lambda: f"Sender has used {_plural(v, 'device')} recently",
        "unique_ips": lambda: f"Sender has used {_plural(v, 'network')} recently",
        "amount": lambda: f"Payment amount is ₹{v:,.0f}",
        "amount_zscore": lambda: f"Amount is {v:+.1f} standard deviations from this sender's norm",
        "velocity_zscore": lambda: "Sender is paying much faster than usual",
        "sender_transactions_last_1hr": lambda: f"Sender made {_plural(v, 'payment')} in the last hour",
        "same_amount_ratio": lambda: f"{pct(v)} of recent payments to this recipient are the identical amount",
        "sender_prior_payments_to_recipient": lambda: f"{_plural(v, 'earlier payment')} already made to this recipient",
        "amount_growth_vs_prior": lambda: f"Amount is {v:.1f}x the previous payment to this recipient",
        "hour_of_day": lambda: f"Payment made at {int(v):02d}:00",
        "time_since_last_transaction": lambda: "Sender was inactive before this payment",
    }
    fn = table.get(feature)
    return fn() if fn else f"{FEATURE_LABELS.get(feature, feature)}: {v:g}"


def impact_level(logit_contribution: float) -> str:
    if logit_contribution >= HIGH_LOGIT:
        return "high"
    if logit_contribution >= MEDIUM_LOGIT:
        return "medium"
    return "low"


def top_factors(names: Sequence[str], values: Sequence[float], contribs: Sequence[float], k: int = 5) -> List[Dict]:
    """Risk-raising factors ranked by contribution to the model's log-odds."""
    ranked = sorted(range(len(names)), key=lambda i: contribs[i], reverse=True)
    out = []
    for i in ranked:
        if contribs[i] < MIN_LOGIT or len(out) >= k:
            break
        out.append({
            "feature": names[i],
            "label": FEATURE_LABELS.get(names[i], names[i]),
            "impact": impact_level(contribs[i]),
            "value": round(float(values[i]), 4),
            "contribution": round(float(contribs[i]), 4),
            "text": describe(names[i], float(values[i])),
        })
    return out


def protective_factors(names: Sequence[str], values: Sequence[float], contribs: Sequence[float], k: int = 3) -> List[Dict]:
    ranked = sorted(range(len(names)), key=lambda i: contribs[i])
    return [{
        "feature": names[i], "label": FEATURE_LABELS.get(names[i], names[i]),
        "value": round(float(values[i]), 4), "contribution": round(float(contribs[i]), 4),
        "text": describe(names[i], float(values[i])),
    } for i in ranked[:k] if contribs[i] <= -MEDIUM_LOGIT]
