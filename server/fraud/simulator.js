// Seeded live-transaction simulator. Deterministic for a given seed (no Math.random), so
// demos and tests are reproducible. It only decides WHO pays WHOM and how much; every
// score comes from the real engines.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

const logNormal = (rand, median, sigma) => {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(10, Math.round(median * Math.exp(sigma * z)));
};

export class TransactionSimulator {
  constructor(world, { seed = 2026, mix = { legit: 0.78, suspicious: 0.12, scam: 0.1 }, maxGap = 10 } = {}) {
    this.maxGap = maxGap;
    this.sinceScam = 0;
    this.pools = world.livePools;
    this.mix = mix;
    this.seed = seed;
    this.rand = mulberry32(seed);
    this.count = 0;
  }

  reset() {
    this.rand = mulberry32(this.seed);
    this.count = 0;
    this.sinceScam = 0;
  }

  next() {
    const forced = this.sinceScam >= this.maxGap;
    const r = forced ? 0 : this.rand();
    const sender = pick(this.rand, this.pools.users);
    let kind = "legit";
    let recipient;
    let amount;
    this.sinceScam += 1;
    if (r < this.mix.scam) {
      this.sinceScam = 0;
      kind = "scam";
      const picked = pick(this.rand, this.pools.scam);
      recipient = forced ? this.pools.scam[0] : picked;
      amount = pick(this.rand, [499, 999, 1499, 2999, 4999]);
    } else if (r < this.mix.scam + this.mix.suspicious) {
      kind = "suspicious";
      recipient = pick(this.rand, this.pools.suspicious);
      amount = pick(this.rand, [1500, 2000, 2500, 3000]);
    } else {
      const contacts = this.pools.contacts[sender] || this.pools.merchants;
      recipient = this.rand() < 0.8 ? pick(this.rand, contacts) : pick(this.rand, this.pools.merchants);
      amount = logNormal(this.rand, 700, 0.9);
    }
    if (recipient === sender) recipient = pick(this.rand, this.pools.merchants);
    this.count += 1;
    return {
      kind,
      transaction: { senderId: sender, recipientId: recipient, amount, deviceId: `D_${sender}`, ipAddress: `IP_${sender}` },
    };
  }
}
