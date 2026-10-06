"""Graph features derived from the point-in-time account graph.

Nodes are accounts. Traversal follows two kinds of edges:
  * money-flow edges - A -> B when A has paid B, followed only out of AGGREGATOR accounts
                       (>= 8 distinct payers). That tracks mule/collector chains downstream
                       without flagging ordinary victims (who also pay scam accounts) or
                       linking every merchant to every scam within three hops.
  * infra edges      - A and B used the same device (or the same low-traffic IP)
`graph_degree` additionally counts every payment counterparty in either direction.

Everything here only reads state that existed *before* the transaction being
scored, so these features are leakage-free by construction.

`graph_risk_score` is a transparent, hand-weighted score (0-100) so the graph
engine stays independently explainable. It is also fed to the ML model as one
of its input features, which lets the model learn how much to trust it.
"""
from __future__ import annotations

from collections import deque
from typing import TYPE_CHECKING, Dict, List, Set

if TYPE_CHECKING:  # pragma: no cover
    from features.feature_engineering import FeatureStore

MAX_HOPS = 3
NO_BLOCKED_DISTANCE = MAX_HOPS + 1
FLAG_COMPLAINTS = 3          # complaints needed before an account counts as "flagged"
AGGREGATOR_MIN_SENDERS = 8
FLOW_FANOUT = 12             # most recent payment neighbours expanded per node
DEVICE_HUB_LIMIT = 50        # devices shared by more accounts than this are ignored as noise
IP_HUB_LIMIT = 5             # shared IPs (carrier NAT, cafes) are only trusted when tiny
MAX_VISITED = 120


def graph_risk_score(
    *,
    recipient_blocked: bool,
    distance_to_blocked: int,
    connected_blocked: int,
    connected_scam: int,
    connected_victims: int,
    ring_size: int,
) -> float:
    """Explainable 0-100 score. Mirrored by server/fraud/graphEngine.js."""
    if recipient_blocked:
        return 100.0
    score = 0.0
    score += {1: 60.0, 2: 40.0, 3: 20.0}.get(distance_to_blocked, 0.0)
    score += min(20.0, 7.0 * connected_blocked)
    score += min(15.0, 4.0 * max(0, connected_scam - connected_blocked))
    score += min(10.0, 1.0 * connected_victims)
    score += min(10.0, 2.0 * max(0, ring_size - 1))
    return float(min(100.0, score))


def neighbours(store: "FeatureStore", account_id: str) -> List[str]:
    acct = store.accounts.get(account_id)
    if acct is None:
        return []
    out: Dict[str, None] = {}
    if len(acct.senders) >= AGGREGATOR_MIN_SENDERS:
        for n in list(acct.out_adj.keys())[-FLOW_FANOUT:]:
            out[n] = None
    for dev in acct.devices:
        users = store.device_users.get(dev, ())
        if 1 < len(users) <= DEVICE_HUB_LIMIT:
            for n in users:
                out[n] = None
    for ip in acct.ips:
        users = store.ip_users.get(ip, ())
        if 1 < len(users) <= IP_HUB_LIMIT:
            for n in users:
                out[n] = None
    out.pop(account_id, None)
    return list(out)


def is_flagged(store: "FeatureStore", account_id: str) -> bool:
    a = store.accounts.get(account_id)
    return a is not None and (a.blocked_ts is not None or a.complaints >= FLAG_COMPLAINTS)


def graph_features(store: "FeatureStore", recipient_id: str) -> dict:
    acct = store.accounts.get(recipient_id)
    if acct is None:
        return {
            "graph_degree": 0, "graph_risk_score": 0.0, "connected_blocked_accounts": 0,
            "connected_scam_accounts": 0, "connected_victims": 0,
            "distance_to_blocked_entity": NO_BLOCKED_DISTANCE, "_ring_size": 1,
        }

    degree_set: Set[str] = set(neighbours(store, recipient_id))
    degree_set.update(acct.adj.keys())

    dist = {recipient_id: 0}
    queue = deque([recipient_id])
    while queue and len(dist) < MAX_VISITED:
        node = queue.popleft()
        d = dist[node]
        if d >= MAX_HOPS:
            continue
        for nb in neighbours(store, node):
            if nb not in dist:
                dist[nb] = d + 1
                queue.append(nb)

    blocked_nodes = []
    flagged_nodes = []
    for node, d in dist.items():
        if node == recipient_id:
            continue
        a = store.accounts.get(node)
        if a is None:
            continue
        if a.blocked_ts is not None:
            blocked_nodes.append((node, d))
        if a.blocked_ts is not None or a.complaints >= FLAG_COMPLAINTS:
            flagged_nodes.append((node, d))

    recipient_blocked = acct.blocked_ts is not None
    nearest = 0 if recipient_blocked else min((d for _, d in blocked_nodes), default=NO_BLOCKED_DISTANCE)

    victims: Set[str] = set(acct.reporters)
    for node, d in flagged_nodes:
        if d <= 2:
            victims.update(store.accounts[node].reporters)

    ring: Set[str] = {recipient_id}
    for dev in acct.devices:
        users = store.device_users.get(dev, ())
        if len(users) <= DEVICE_HUB_LIMIT:
            ring.update(users)

    n_blocked = len(blocked_nodes)
    n_scam = len(flagged_nodes)
    score = graph_risk_score(
        recipient_blocked=recipient_blocked,
        distance_to_blocked=nearest,
        connected_blocked=n_blocked,
        connected_scam=n_scam,
        connected_victims=len(victims),
        ring_size=len(ring),
    )
    return {
        "graph_degree": len(degree_set),
        "graph_risk_score": round(score, 2),
        "connected_blocked_accounts": n_blocked,
        "connected_scam_accounts": n_scam,
        "connected_victims": len(victims),
        "distance_to_blocked_entity": nearest,
        "_ring_size": len(ring),
    }
