import { inr } from "./DecisionCard.jsx";

const CASES = [
  { id: "normal", icon: "✓", tone: "safe", expect: "Expected: safe" },
  { id: "suspicious", icon: "!", tone: "warn", expect: "Expected: warning" },
  { id: "scam", icon: "✕", tone: "danger", expect: "Expected: block" },
];

export default function CaseCards({ scenarios, busy, activeCase, onRun }) {
  return (
    <section className="case-grid" aria-label="Demo cases">
      {CASES.map((c) => {
        const sc = scenarios?.[c.id];
        return (
          <button
            key={c.id}
            type="button"
            className={`case-card case-${c.tone} ${activeCase === c.id ? "active" : ""}`}
            disabled={Boolean(busy) || !sc}
            onClick={() => onRun(c.id)}
            data-testid={`case-${c.id}`}
          >
            <span className="case-icon" aria-hidden="true">{busy === c.id ? "…" : c.icon}</span>
            <span className="case-body">
              <strong>{sc?.label || c.id}</strong>
              {sc && <span className="case-tx">{inr(sc.transaction.amount)} → {sc.transaction.recipientId}</span>}
              <span className="case-story">{sc?.story}</span>
            </span>
            <span className="case-run">Run ▸</span>
          </button>
        );
      })}
    </section>
  );
}
