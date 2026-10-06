// Graph engine: "is this recipient connected to a larger suspicious network?"
// Traversal rules and the 0-100 score mirror ml/features/graph.py, so the engine is fully
// explainable on its own and its score is also one of the ML model's input features.

export const MAX_HOPS = 3;
export const NO_BLOCKED_DISTANCE = MAX_HOPS + 1;
const FLAG_COMPLAINTS = 3;
const AGGREGATOR_MIN_SENDERS = 8;
const FLOW_FANOUT = 12;
const DEVICE_HUB_LIMIT = 50;
const IP_HUB_LIMIT = 5;
const MAX_VISITED = 120;

export function graphRiskScore({ recipientBlocked, distanceToBlocked, connectedBlocked, connectedScam, connectedVictims, ringSize }) {
  if (recipientBlocked) return 100;
  let score = { 1: 60, 2: 40, 3: 20 }[distanceToBlocked] ?? 0;
  score += Math.min(20, 7 * connectedBlocked);
  score += Math.min(15, 4 * Math.max(0, connectedScam - connectedBlocked));
  score += Math.min(10, connectedVictims);
  score += Math.min(10, 2 * Math.max(0, ringSize - 1));
  return Math.min(100, score);
}

function edgesOf(ledger, id) {
  const acct = ledger.accounts.get(id);
  if (!acct) return [];
  const out = new Map();
  if (acct.senders.size >= AGGREGATOR_MIN_SENDERS) {
    for (const n of [...acct.outAdj.keys()].slice(-FLOW_FANOUT)) out.set(n, "payment");
  }
  for (const dev of acct.devices.keys()) {
    const users = ledger.deviceUsers.get(dev);
    if (users && users.size > 1 && users.size <= DEVICE_HUB_LIMIT) for (const n of users) if (!out.has(n)) out.set(n, "device");
  }
  for (const ip of acct.ips.keys()) {
    const users = ledger.ipUsers.get(ip);
    if (users && users.size > 1 && users.size <= IP_HUB_LIMIT) for (const n of users) if (!out.has(n)) out.set(n, "ip");
  }
  out.delete(id);
  return [...out];
}

const isFlagged = (a) => a && (a.blockedTs !== null || a.complaints >= FLAG_COMPLAINTS);

export function analyzeGraph(ledger, recipientId) {
  const acct = ledger.accounts.get(recipientId);
  if (!acct) {
    return { score: 0, degree: 0, connectedBlocked: 0, connectedFlagged: 0, connectedVictims: 0, distanceToBlocked: NO_BLOCKED_DISTANCE, ringSize: 1, blockedIds: [], flaggedIds: [], reasons: [] };
  }
  const degree = new Set([...acct.adj.keys(), ...edgesOf(ledger, recipientId).map(([n]) => n)]);

  const dist = new Map([[recipientId, 0]]);
  const queue = [recipientId];
  for (let head = 0; head < queue.length && dist.size < MAX_VISITED; head += 1) {
    const node = queue[head];
    const d = dist.get(node);
    if (d >= MAX_HOPS) continue;
    for (const [nb] of edgesOf(ledger, node)) {
      if (!dist.has(nb)) {
        dist.set(nb, d + 1);
        queue.push(nb);
      }
    }
  }

  const blocked = [];
  const flagged = [];
  for (const [node, d] of dist) {
    if (node === recipientId) continue;
    const a = ledger.accounts.get(node);
    if (!a) continue;
    if (a.blockedTs !== null) blocked.push([node, d]);
    if (isFlagged(a)) flagged.push([node, d]);
  }

  const recipientBlocked = acct.blockedTs !== null;
  const distanceToBlocked = recipientBlocked ? 0 : Math.min(NO_BLOCKED_DISTANCE, ...blocked.map(([, d]) => d));
  const victims = new Set(acct.reporters);
  for (const [node, d] of flagged) if (d <= 2) for (const v of ledger.accounts.get(node).reporters) victims.add(v);

  const ring = new Set([recipientId]);
  for (const dev of acct.devices.keys()) {
    const users = ledger.deviceUsers.get(dev);
    if (users && users.size <= DEVICE_HUB_LIMIT) for (const u of users) ring.add(u);
  }

  const score = graphRiskScore({
    recipientBlocked,
    distanceToBlocked,
    connectedBlocked: blocked.length,
    connectedScam: flagged.length,
    connectedVictims: victims.size,
    ringSize: ring.size,
  });

  const reasons = [];
  if (recipientBlocked) reasons.push("Recipient account is blocked");
  if (blocked.length) reasons.push(`Connected to ${blocked.length} blocked ${blocked.length === 1 ? "entity" : "entities"}`);
  if (ring.size > 2) reasons.push(`Same device is associated with ${ring.size} accounts`);
  if (victims.size) reasons.push(`${victims.size} reported ${victims.size === 1 ? "victim is" : "victims are"} linked to this network`);

  return {
    score: Math.round(score),
    degree: degree.size,
    connectedBlocked: blocked.length,
    connectedFlagged: flagged.length,
    connectedVictims: victims.size,
    distanceToBlocked,
    ringSize: ring.size,
    blockedIds: blocked.map(([n]) => n),
    flaggedIds: flagged.map(([n]) => n),
    reasons,
  };
}

/** Subgraph around an account for the "Investigate Network" view. */
export function buildNetwork(ledger, rootId, { maxNodes = 36, maxPayers = 10 } = {}) {
  const root = ledger.accounts.get(rootId);
  if (!root) return { nodes: [], edges: [], summary: null, mulePath: null };
  const nodes = new Map();
  const edges = [];
  const addNode = (id, hop, role) => {
    if (nodes.has(id) || nodes.size >= maxNodes) return nodes.has(id);
    const a = ledger.accounts.get(id);
    nodes.set(id, {
      id,
      hop,
      role,
      blocked: Boolean(a && a.blockedTs !== null),
      flagged: Boolean(isFlagged(a)),
      complaints: a?.complaints || 0,
      payments: a?.nIn || 0,
      senders: a?.senders.size || 0,
      nOut: a?.nOut || 0,
    });
    return true;
  };
  const link = (source, target, type, weight = 1, meta = {}) => {
    if (nodes.has(source) && nodes.has(target) && !edges.some((e) => e.source === source && e.target === target && e.type === type)) {
      edges.push({ source, target, type, weight, ...meta });
    }
  };

  addNode(rootId, 0, "target");
  const dist = new Map([[rootId, 0]]);
  const queue = [rootId];
  for (let head = 0; head < queue.length && nodes.size < maxNodes; head += 1) {
    const node = queue[head];
    const d = dist.get(node);
    if (d >= 2) continue;
    for (const [nb, type] of edgesOf(ledger, node)) {
      if (!dist.has(nb)) {
        dist.set(nb, d + 1);
        queue.push(nb);
        const a = ledger.accounts.get(nb);
        addNode(nb, d + 1, a?.blockedTs !== null ? "blocked" : type === "payment" ? "collector" : "ring");
      }
      link(node, nb, type);
    }
  }

  const payers = new Map();
  for (const e of [...root.inEv].reverse()) {
    if (payers.size >= maxPayers) break;
    payers.set(e.sender, (payers.get(e.sender) || 0) + e.amount);
  }
  for (const [id, total] of payers) {
    addNode(id, 1, "payer");
    link(id, rootId, "payment", total);
  }

  // Fund-forward / mule hops: follow outgoing payments from the recipient
  const mulePath = [];
  const seen = new Set([rootId]);
  let cursor = rootId;
  let hop = 0;
  while (hop < 4) {
    const acct = ledger.accounts.get(cursor);
    if (!acct || !acct.outAdj?.size) break;
    // Pick the largest recent outgoing destination
    const outTotals = new Map();
    for (const e of acct.outEv || []) {
      // outEv only has {ts, amount} — recover counterparties from outAdj order + events store
    }
    // Use outAdj keys; estimate amount from contacts on the sender side isn't on recipient.
    // Walk ledger events for outgoing txs from cursor.
    const forwards = [];
    for (const ev of ledger.events) {
      if (ev.type === "transaction" && ev.sender_id === cursor) {
        forwards.push({ id: ev.recipient_id, amount: ev.amount, ts: ev.ts });
      }
    }
    if (!forwards.length) break;
    // Aggregate by recipient, take top
    const agg = new Map();
    for (const f of forwards) {
      const cur = agg.get(f.id) || { id: f.id, amount: 0, ts: 0 };
      cur.amount += f.amount;
      cur.ts = Math.max(cur.ts, f.ts);
      agg.set(f.id, cur);
    }
    const next = [...agg.values()].sort((a, b) => b.amount - a.amount)[0];
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    hop += 1;
    addNode(next.id, hop, ledger.accounts.get(next.id)?.blockedTs != null ? "blocked" : "mule");
    link(cursor, next.id, "fund_forward", next.amount, { mule: true, hop });
    mulePath.push({ from: cursor, to: next.id, amount: next.amount, hop });
    cursor = next.id;
  }

  const list = [...nodes.values()];
  const muleAmount = mulePath.reduce((s, h) => s + h.amount, 0);
  return {
    nodes: list,
    edges,
    mulePath,
    summary: {
      accounts: list.length,
      blocked: list.filter((n) => n.blocked).length,
      flagged: list.filter((n) => n.flagged).length,
      payers: list.filter((n) => n.role === "payer").length,
      victimsReported: root.reporters.size,
      muleHops: mulePath.length,
      muleAmount: Math.round(muleAmount),
    },
  };
}
