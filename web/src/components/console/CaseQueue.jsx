const STATUS_LABEL = {
  open: "Open",
  confirmed_fraud: "Confirmed",
  false_positive: "False +",
  escalated: "Escalated",
};

const TONE = { SAFE: "safe", WARNING: "warn", BLOCK: "danger" };

function ageLabel(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  return `${Math.round(ms / 3600000)}h ago`;
}

export default function CaseQueue({ cases, selectedId, onSelect, listRef }) {
  if (!cases.length) {
    return (
      <div className="panel console-empty" data-testid="queue-empty">
        <div className="empty-icon" aria-hidden="true">📋</div>
        <h3>No cases in queue</h3>
        <p className="muted">Non-SAFE fraud decisions appear here automatically. Use &ldquo;Populate demo cases&rdquo; to seed simulated alerts.</p>
      </div>
    );
  }

  return (
    <div className="panel console-queue" data-testid="case-queue">
      <ul className="console-queue-list" ref={listRef} role="listbox" aria-label="Case queue">
        {cases.map((c) => {
          const snap = c.decisionSnapshot;
          const tone = TONE[snap.decision] || "warn";
          return (
            <li key={c.id} role="option" aria-selected={c.id === selectedId}>
              <button
                type="button"
                className={`console-queue-item${c.id === selectedId ? " selected" : ""}`}
                onClick={() => onSelect(c.id)}
                data-testid={`case-item-${c.id}`}
              >
                <div className="console-queue-top">
                  <span className={`badge badge-${tone}`}>{snap.decision}</span>
                  <strong>{snap.riskScore}</strong>
                </div>
                <div className="small">{snap.transaction.senderId} → {snap.transaction.recipientId}</div>
                <div className="console-queue-meta">
                  ₹{Number(snap.transaction.amount).toLocaleString("en-IN")} · {STATUS_LABEL[c.status] || c.status} · {ageLabel(c.createdAt)}
                  {c.simulated && " · simulated"}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
