import { inr } from "./DecisionCard.jsx";

const TONE = { SAFE: "safe", WARNING: "warn", BLOCK: "danger" };

export function ThreatAlert({ threat, onView, onInvestigate, onDismiss }) {
  if (!threat) return null;
  const lead = threat.ml.topFactors?.find((f) => f.impact !== "low")?.text || threat.explanation[0];
  return (
    <div className="threat-alert" role="alert" data-testid="threat-alert">
      <div className="threat-pulse" aria-hidden="true" />
      <div className="threat-body">
        <strong className="threat-title">NEW THREAT DETECTED</strong>
        <div>
          {inr(threat.transaction.amount)} to <b>{threat.transaction.recipientId}</b> blocked - risk {threat.riskScore}/100 ({threat.riskLevel})
        </div>
        <div className="small">{lead}</div>
      </div>
      <div className="threat-actions">
        <button type="button" className="btn btn-danger" onClick={() => onView(threat)}>View analysis</button>
        <button type="button" className="btn btn-secondary" onClick={() => onInvestigate(threat.transaction.recipientId)}>Investigate</button>
        <button type="button" className="btn btn-secondary" onClick={onDismiss} aria-label="Dismiss alert">✕</button>
      </div>
    </div>
  );
}

export default function LiveStream({ items, running, onToggle, onSelect, selectedId, counts }) {
  return (
    <section className="panel stack" data-testid="live-stream">
      <div className="ml-head">
        <div>
          <span className="eyebrow">Live simulation</span>
          <h3 style={{ margin: 0 }}>Payment stream</h3>
        </div>
        <button type="button" className={`btn ${running ? "btn-secondary" : "btn-primary"}`} onClick={onToggle} data-testid="stream-toggle">
          {running ? "⏸ Pause stream" : "▶ Start stream"}
        </button>
      </div>
      <div className="dist-bar" aria-hidden="true" title="Share of safe / warning / blocked payments">
        {counts.total === 0 ? <span className="dist-empty" /> : ["SAFE", "WARNING", "BLOCK"].map((k) => (
          <span key={k} className={`dist-${TONE[k]}`} style={{ width: `${(counts[k] / counts.total) * 100}%` }} />
        ))}
      </div>
      <div className="chip-row">
        <span className="chip">{counts.total} scored</span>
        <span className="chip chip-ok">{counts.SAFE} safe</span>
        <span className="chip chip-warn">{counts.WARNING} warning</span>
        <span className="chip chip-bad">{counts.BLOCK} blocked</span>
      </div>
      {items.length === 0 ? (
        <div className="stream-empty">
          <p className="muted small" style={{ margin: 0 }}>
            Start the stream to score simulated payments with the real model, graph and rule engines. The generator uses a fixed seed, so every run is reproducible.
          </p>
        </div>
      ) : (
        <ul className="stream-list">
          {items.map((d) => (
            <li key={d.id}>
              <button type="button" className={`stream-row stream-${TONE[d.decision]} ${selectedId === d.id ? "selected" : ""}`} onClick={() => onSelect(d)}>
                <span className={`decision-badge badge-${TONE[d.decision]}`}>{d.decision}</span>
                <span className="stream-main">
                  <b>{inr(d.transaction.amount)}</b>
                  <span className="stream-parties">{d.transaction.senderId} → {d.transaction.recipientId}</span>
                </span>
                <span className="stream-score">{d.riskScore}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
