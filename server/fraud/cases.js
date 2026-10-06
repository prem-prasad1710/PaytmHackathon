const MAX_STORE = 500;
const VERDICTS = new Set(["confirmed_fraud", "false_positive", "escalate"]);
const REVIEWED_STATUSES = new Set(["confirmed_fraud", "false_positive", "escalated"]);
const ENGINE_FLAG = 50;

function snapshotFromDecision(decision) {
  const { transaction, ml, graph, rules, aggregation } = decision;
  return {
    id: decision.id,
    riskScore: decision.riskScore,
    riskLevel: decision.riskLevel,
    decision: decision.decision,
    mlAvailable: decision.mlAvailable,
    ml: {
      score: ml?.score ?? null,
      probability: ml?.probability ?? null,
      topFactors: ml?.topFactors || [],
      modelVersion: ml?.modelVersion ?? null,
    },
    graph: { score: graph?.score ?? null, reasons: graph?.reasons || [] },
    rules: { score: rules?.score ?? null, triggeredRules: rules?.triggeredRules || [], details: rules?.details || [] },
    overrides: aggregation?.overridesApplied || [],
    facts: decision.facts || null,
    transaction: {
      senderId: transaction.senderId,
      recipientId: transaction.recipientId,
      amount: transaction.amount,
    },
    summary: decision.summary || null,
  };
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function wilsonInterval(successes, n, z = 1.96) {
  if (n <= 0) return null;
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return {
    low: Number(Math.max(0, center - margin).toFixed(4)),
    high: Number(Math.min(1, center + margin).toFixed(4)),
  };
}

function engineAgreed(score, analystConfirmedFraud) {
  if (score === null || score === undefined) return null;
  return analystConfirmedFraud ? score >= ENGINE_FLAG : score < ENGINE_FLAG;
}

export class CaseStore {
  constructor({ maxSize = MAX_STORE } = {}) {
    this.maxSize = maxSize;
    this.cases = new Map();
    this.seen = new Set();
  }

  attach(engine) {
    for (const d of engine.recent(60)) {
      const meta = d.scenario ? { scenario: d.scenario } : d.live ? { live: true } : {};
      this.ingest(d, meta);
    }
    engine.onDecision((decision, meta) => this.ingest(decision, meta));
  }

  ingest(decision, meta = {}) {
    if (!decision || decision.decision === "SAFE") return null;
    const id = decision.id;
    if (!id || this.seen.has(id)) return this.cases.get(id) || null;

    const createdAt = new Date((decision.timestamp || Date.now() / 1000) * 1000).toISOString();
    const caseRecord = {
      id,
      createdAt,
      decisionSnapshot: snapshotFromDecision(decision),
      status: "open",
      analystNote: null,
      reviewedAt: null,
      reviewTimeMs: null,
      history: [],
      simulated: Boolean(meta.seeded || meta.live),
      source: meta.scenario ? "scenario" : meta.seeded ? "seed" : meta.live ? "live" : "evaluate",
    };
    this.seen.add(id);
    this.cases.set(id, caseRecord);
    this.#evictIfNeeded();
    return caseRecord;
  }

  #evictIfNeeded() {
    if (this.cases.size <= this.maxSize) return;
    const ranked = [...this.cases.values()].sort((a, b) => {
      const aReviewed = REVIEWED_STATUSES.has(a.status) ? 0 : 1;
      const bReviewed = REVIEWED_STATUSES.has(b.status) ? 0 : 1;
      if (aReviewed !== bReviewed) return aReviewed - bReviewed;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    while (this.cases.size > this.maxSize && ranked.length) {
      const victim = ranked.shift();
      this.cases.delete(victim.id);
      this.seen.delete(victim.id);
    }
  }

  list({ status, decision, limit = 50, sort = "age" } = {}) {
    let rows = [...this.cases.values()];
    if (status) rows = rows.filter((c) => c.status === status);
    if (decision) rows = rows.filter((c) => c.decisionSnapshot.decision === decision);
    if (sort === "score") rows.sort((a, b) => b.decisionSnapshot.riskScore - a.decisionSnapshot.riskScore);
    else rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const cap = Math.min(200, Math.max(1, Number(limit) || 50));
    return rows.slice(0, cap);
  }

  get(id) {
    return this.cases.get(id) || null;
  }

  review(id, { verdict, note = "" } = {}) {
    if (!VERDICTS.has(verdict)) {
      const err = new Error(`verdict must be one of: ${[...VERDICTS].join(", ")}`);
      err.status = 400;
      throw err;
    }
    const caseRecord = this.cases.get(id);
    if (!caseRecord) {
      const err = new Error("case not found");
      err.status = 404;
      throw err;
    }
    const reviewedAt = new Date().toISOString();
    const reviewTimeMs = Math.max(0, Date.now() - new Date(caseRecord.createdAt).getTime());
    if (caseRecord.status !== "open" && caseRecord.reviewedAt) {
      caseRecord.history.push({
        status: caseRecord.status,
        analystNote: caseRecord.analystNote,
        reviewedAt: caseRecord.reviewedAt,
        reviewTimeMs: caseRecord.reviewTimeMs,
      });
    }
    caseRecord.status = verdict === "escalate" ? "escalated" : verdict;
    caseRecord.analystNote = String(note || "").slice(0, 2000) || null;
    caseRecord.reviewedAt = reviewedAt;
    caseRecord.reviewTimeMs = reviewTimeMs;
    return caseRecord;
  }

  stats() {
    const all = [...this.cases.values()];
    const byStatus = { open: 0, confirmed_fraud: 0, false_positive: 0, escalated: 0 };
    const byDecision = { WARNING: { reviewed: 0, confirmed_fraud: 0, false_positive: 0 }, BLOCK: { reviewed: 0, confirmed_fraud: 0, false_positive: 0 } };
    for (const c of all) byStatus[c.status] = (byStatus[c.status] || 0) + 1;

    const reviewed = all.filter((c) => REVIEWED_STATUSES.has(c.status));
    const labelled = reviewed.filter((c) => c.status === "confirmed_fraud" || c.status === "false_positive");
    const confirmed = labelled.filter((c) => c.status === "confirmed_fraud").length;
    const falsePos = labelled.filter((c) => c.status === "false_positive").length;
    const labelN = confirmed + falsePos;

    for (const c of labelled) {
      const d = c.decisionSnapshot.decision;
      if (!byDecision[d]) byDecision[d] = { reviewed: 0, confirmed_fraud: 0, false_positive: 0 };
      byDecision[d].reviewed += 1;
      byDecision[d][c.status] += 1;
    }

    const reviewTimes = labelled.map((c) => c.reviewTimeMs).filter((v) => v !== null);
    const openCases = all.filter((c) => c.status === "open");
    const backlogAges = openCases.map((c) => Date.now() - new Date(c.createdAt).getTime());

    const agreement = { ml: { agreed: 0, total: 0 }, graph: { agreed: 0, total: 0 }, rules: { agreed: 0, total: 0 } };
    for (const c of labelled) {
      const snap = c.decisionSnapshot;
      const analystFraud = c.status === "confirmed_fraud";
      for (const [key, score] of [["ml", snap.ml.score], ["graph", snap.graph.score], ["rules", snap.rules.score]]) {
        if (key === "ml" && !snap.mlAvailable) continue;
        const agreed = engineAgreed(score, analystFraud);
        if (agreed === null) continue;
        agreement[key].total += 1;
        if (agreed) agreement[key].agreed += 1;
      }
    }

    const precision = labelN > 0 ? confirmed / labelN : null;
    const fpRate = labelN > 0 ? falsePos / labelN : null;

    return {
      total: all.length,
      byStatus,
      open: byStatus.open,
      reviewed: labelled.length,
      escalated: byStatus.escalated,
      alertPrecision: precision !== null ? Number(precision.toFixed(4)) : null,
      alertPrecisionCi: labelN >= 1 ? wilsonInterval(confirmed, labelN) : null,
      alertPrecisionSampleSize: labelN,
      falsePositiveRate: fpRate !== null ? Number(fpRate.toFixed(4)) : null,
      meanReviewTimeMs: reviewTimes.length ? Number(mean(reviewTimes).toFixed(0)) : null,
      medianReviewTimeMs: reviewTimes.length ? Number(median(reviewTimes).toFixed(0)) : null,
      backlogAgeMs: backlogAges.length ? { max: Math.max(...backlogAges), mean: Number(mean(backlogAges).toFixed(0)) } : null,
      engineAgreement: {
        ml: agreement.ml.total >= 3 ? { rate: Number((agreement.ml.agreed / agreement.ml.total).toFixed(4)), reviewed: agreement.ml.total } : null,
        graph: agreement.graph.total >= 3 ? { rate: Number((agreement.graph.agreed / agreement.graph.total).toFixed(4)), reviewed: agreement.graph.total } : null,
        rules: agreement.rules.total >= 3 ? { rate: Number((agreement.rules.agreed / agreement.rules.total).toFixed(4)), reviewed: agreement.rules.total } : null,
      },
      reviewedByDecision: byDecision,
    };
  }

  exportJsonl() {
    const lines = [];
    for (const c of this.cases.values()) {
      if (!REVIEWED_STATUSES.has(c.status) || c.status === "escalated") continue;
      const snap = c.decisionSnapshot;
      lines.push(JSON.stringify({
        caseId: c.id,
        label: c.status,
        reviewedAt: c.reviewedAt,
        reviewTimeMs: c.reviewTimeMs,
        analystNote: c.analystNote,
        features: snap.facts,
        scores: {
          risk: snap.riskScore,
          ml: snap.ml.score,
          graph: snap.graph.score,
          rules: snap.rules.score,
        },
        decision: snap.decision,
        triggeredRules: snap.rules.triggeredRules,
        overrides: snap.overrides.map((o) => o.id),
        transaction: snap.transaction,
      }));
    }
    return lines.join("\n") + (lines.length ? "\n" : "");
  }

  clear() {
    this.cases.clear();
    this.seen.clear();
  }
}
