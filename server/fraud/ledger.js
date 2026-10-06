// Event-sourced ledger used by the graph and rule engines. It is a deliberately small
// JavaScript counterpart of ml/features/FeatureStore: it lets the payment-risk system keep
// working (rules + graph) when the Python ML service is down. ML features themselves are
// ALWAYS computed in Python so training and serving share one implementation.

export const DAY = 86400;
const LOG_PRIOR_MEAN = Math.log1p(500);
const LOG_PRIOR_VAR = 1.2 ** 2;
const PRIOR_N = 3;

class Account {
  constructor(created) {
    this.created = created;
    this.devices = new Map();
    this.ips = new Map();
    this.lastDevice = null;
    this.lastIp = null;
    this.inEv = [];
    this.outEv = [];
    this.nIn = 0;
    this.nOut = 0;
    this.senders = new Set();
    this.complaints = 0;
    this.reporters = new Set();
    this.blockedTs = null;
    this.firstTxTs = null;
    this.lastTxTs = null;
    this.logN = 0;
    this.logSum = 0;
    this.logM2 = 0;
    this.contacts = new Map();
    this.adj = new Map();
    this.outAdj = new Map();
  }
}

const touch = (map, key) => {
  map.delete(key);
  map.set(key, null);
};

export class Ledger {
  constructor() {
    this.reset();
  }

  reset() {
    this.accounts = new Map();
    this.deviceUsers = new Map();
    this.ipUsers = new Map();
    this.events = [];
    this.lastTs = 0;
  }

  get eventCount() {
    return this.events.length;
  }

  apply(ev) {
    switch (ev.type) {
      case "account_created":
        this.#account(ev);
        break;
      case "transaction":
        this.#transaction(ev);
        break;
      case "complaint": {
        const a = this.#ensure(ev.account_id, ev.ts);
        a.complaints += 1;
        if (ev.reporter_id) a.reporters.add(ev.reporter_id);
        break;
      }
      case "block": {
        const a = this.#ensure(ev.account_id, ev.ts);
        if (a.blockedTs === null) a.blockedTs = ev.ts;
        break;
      }
      default:
        throw new Error(`unknown event type: ${ev.type}`);
    }
    this.events.push(ev);
    this.lastTs = Math.max(this.lastTs, ev.ts);
  }

  load(events) {
    this.reset();
    [...events].sort((a, b) => a.ts - b.ts).forEach((ev) => this.apply(ev));
  }

  #ensure(id, ts) {
    let a = this.accounts.get(id);
    if (!a) {
      a = new Account(ts);
      this.accounts.set(id, a);
    }
    return a;
  }

  #registerInfra(a, id, device, ip, ts) {
    if (device) {
      if (!a.devices.has(device)) a.devices.set(device, ts);
      a.lastDevice = device;
      if (!this.deviceUsers.has(device)) this.deviceUsers.set(device, new Set());
      this.deviceUsers.get(device).add(id);
    }
    if (ip) {
      if (!a.ips.has(ip)) a.ips.set(ip, ts);
      a.lastIp = ip;
      if (!this.ipUsers.has(ip)) this.ipUsers.set(ip, new Set());
      this.ipUsers.get(ip).add(id);
    }
  }

  #account(ev) {
    const a = this.#ensure(ev.account_id, ev.ts);
    a.created = Math.min(a.created, ev.ts);
    this.#registerInfra(a, ev.account_id, ev.device_id, ev.ip_id, ev.ts);
  }

  #transaction(tx) {
    const { ts, amount, sender_id: sid, recipient_id: rid } = tx;
    const s = this.#ensure(sid, ts);
    const r = this.#ensure(rid, ts);
    this.#registerInfra(s, sid, tx.device_id, tx.ip_id, ts);

    const x = Math.log1p(amount);
    s.logN += 1;
    const oldMean = s.logN > 1 ? s.logSum / (s.logN - 1) : x;
    const delta = x - oldMean;
    s.logSum += x;
    s.logM2 += delta * (x - s.logSum / s.logN);

    if (s.firstTxTs === null) s.firstTxTs = ts;
    s.lastTxTs = ts;
    s.nOut += 1;
    s.outEv.push({ ts, amount });
    const prior = s.contacts.get(rid);
    s.contacts.set(rid, { count: (prior?.count || 0) + 1, last: amount });

    r.nIn += 1;
    r.senders.add(sid);
    r.inEv.push({ ts, amount, sender: sid });

    touch(s.outAdj, rid);
    touch(s.adj, rid);
    touch(r.adj, sid);

    const horizon = ts - DAY;
    for (const a of [s, r]) {
      while (a.inEv.length && a.inEv[0].ts < horizon) a.inEv.shift();
      while (a.outEv.length && a.outEv[0].ts < horizon) a.outEv.shift();
    }
  }

  has(id) {
    return this.accounts.has(id);
  }

  stats() {
    let blocked = 0;
    for (const a of this.accounts.values()) if (a.blockedTs !== null) blocked += 1;
    return { accounts: this.accounts.size, devices: this.deviceUsers.size, events: this.events.length, blockedAccounts: blocked };
  }

  /** Everything the rule and graph engines need to know about a payment, using state BEFORE it. */
  facts(tx) {
    const now = tx.ts;
    const s = this.accounts.get(tx.senderId);
    const r = this.accounts.get(tx.recipientId);

    const win = { p5: 0, p10: 0, p1h: 0, p24: 0, a1h: 0, a24: 0 };
    let sameAmount = 0;
    let recent = 0;
    if (r) {
      for (let i = r.inEv.length - 1; i >= 0; i -= 1) {
        const e = r.inEv[i];
        const age = now - e.ts;
        if (age > DAY) break;
        win.p24 += 1;
        win.a24 += e.amount;
        if (age <= 3600) {
          win.p1h += 1;
          win.a1h += e.amount;
          if (age <= 600) win.p10 += 1;
          if (age <= 300) win.p5 += 1;
        }
        if (recent < 50) {
          recent += 1;
          if (Math.abs(e.amount - tx.amount) < 0.5) sameAmount += 1;
        }
      }
    }

    let outflow1h = 0;
    if (r) {
      for (let i = r.outEv.length - 1; i >= 0; i -= 1) {
        const e = r.outEv[i];
        if (now - e.ts > 3600) break;
        outflow1h += e.amount;
      }
    }

    const dev = tx.deviceId || null;
    const ip = tx.ipAddress || null;
    let newDevice = false;
    let newIp = false;
    let amountZ = 0;
    let newRecipient = true;
    let senderPayments1h = 0;
    if (s) {
      newDevice = Boolean(dev) && (!s.devices.has(dev) || now - s.devices.get(dev) < DAY);
      newIp = Boolean(ip) && (!s.ips.has(ip) || now - s.ips.get(ip) < DAY);
      for (let i = s.outEv.length - 1; i >= 0; i -= 1) {
        if (now - s.outEv[i].ts > 3600) break;
        senderPayments1h += 1;
      }
      const n = s.logN;
      const mean = (s.logSum + PRIOR_N * LOG_PRIOR_MEAN) / (n + PRIOR_N);
      const variance = (s.logM2 + PRIOR_N * LOG_PRIOR_VAR) / (n + PRIOR_N);
      amountZ = (Math.log1p(tx.amount) - mean) / Math.max(0.4, Math.sqrt(variance));
      newRecipient = !s.contacts.has(tx.recipientId);
    }

    return {
      now,
      senderId: tx.senderId,
      recipientId: tx.recipientId,
      amount: tx.amount,
      recipientKnown: Boolean(r),
      recipientAgeDays: r ? Math.max(0, (now - r.created) / DAY) : 0,
      senderAgeDays: s ? Math.max(0, (now - s.created) / DAY) : 0,
      payments5m: win.p5,
      payments10m: win.p10,
      payments1h: win.p1h,
      payments24h: win.p24,
      amount1h: win.a1h,
      amount24h: win.a24,
      recipientPayments: r ? r.nIn : 0,
      uniqueSenders: r ? r.senders.size : 0,
      complaints: r ? r.complaints : 0,
      complaintRate: r ? Math.min(1, r.complaints / Math.max(r.nIn, 1)) : 0,
      recipientBlocked: Boolean(r && r.blockedTs !== null),
      deviceUsers: r?.lastDevice ? (this.deviceUsers.get(r.lastDevice)?.size ?? 0) : 0,
      ipUsers: r?.lastIp ? (this.ipUsers.get(r.lastIp)?.size ?? 0) : 0,
      fundTransferVelocity: win.a1h > 0 ? Math.min(1.5, outflow1h / win.a1h) : 0,
      sameAmountRatio: recent ? sameAmount / recent : 0,
      newRecipient,
      newDevice,
      newIp,
      amountZ,
      senderPayments1h,
    };
  }
}
