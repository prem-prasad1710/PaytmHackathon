import { Link } from "react-router-dom";
import DecisionCard from "../fraud/DecisionCard.jsx";

const STATUS_LABEL = {
  open: "Open",
  confirmed_fraud: "Confirmed fraud",
  false_positive: "False positive",
  escalated: "Escalated",
};

export default function CaseDetail({ caseRecord, onReview, busy, note, setNote }) {
  if (!caseRecord) {
    return (
      <div className="panel console-empty console-detail" data-testid="detail-empty">
        <div className="empty-icon" aria-hidden="true">🔍</div>
        <h3>Select a case</h3>
        <p className="muted">Choose a flagged payment from the queue. Use <kbd>J</kbd> / <kbd>K</kbd> to move up and down.</p>
      </div>
    );
  }

  const snap = caseRecord.decisionSnapshot;
  const decisionResult = {
    ...snap,
    transaction: snap.transaction,
    ml: { ...snap.ml, available: snap.mlAvailable, protectiveFactors: [] },
    graph: snap.graph,
    rules: snap.rules,
    aggregation: { weights: { ml: 0.4, graph: 0.35, rules: 0.25 }, overridesApplied: snap.overrides, weightedScore: snap.riskScore, thresholds: { warning: 35, block: 70 } },
    explanation: snap.summary ? [snap.summary] : ["No explanation stored for this case."],
    summary: snap.summary || "",
  };

  return (
    <div className="panel console-detail" data-testid="case-detail">
      <div className="console-queue-top" style={{ marginBottom: "0.75rem" }}>
        <div>
          <span className="eyebrow">Case {caseRecord.id}</span>
          <div className="small muted">Opened {new Date(caseRecord.createdAt).toLocaleString()}</div>
        </div>
        <span className="chip">{STATUS_LABEL[caseRecord.status]}</span>
      </div>

      <DecisionCard
        result={decisionResult}
        onInvestigate={() => {}}
      />

      <div style={{ marginTop: "0.75rem" }}>
        <Link to="/lab" className="btn btn-secondary small">
          Open Fraud Lab
        </Link>
      </div>

      {snap.overrides?.length > 0 && (
        <div className="alert-banner" style={{ marginTop: "0.75rem" }}>
          <strong>Overrides triggered</strong>
          {snap.overrides.map((o) => <div key={o.id} className="small">{o.id}: {o.detail}</div>)}
        </div>
      )}

      <div className="console-review">
        <label htmlFor="analyst-note"><strong>Analyst note</strong></label>
        <textarea
          id="analyst-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why you confirmed or dismissed this alert…"
          disabled={busy}
        />
        <div className="console-review-actions">
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => onReview("confirmed_fraud")} data-testid="confirm-fraud">
            Confirm fraud
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onReview("false_positive")} data-testid="false-positive">
            False positive
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onReview("escalate")} data-testid="escalate">
            Escalate
          </button>
        </div>
        {caseRecord.reviewedAt && (
          <p className="muted small" style={{ marginTop: "0.5rem" }}>
            Last reviewed {new Date(caseRecord.reviewedAt).toLocaleString()}
            {caseRecord.reviewTimeMs !== null && ` · ${caseRecord.reviewTimeMs}ms to review`}
          </p>
        )}
      </div>
    </div>
  );
}
