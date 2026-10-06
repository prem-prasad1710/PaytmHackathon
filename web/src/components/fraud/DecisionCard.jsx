import { useState } from "react";
import { Link } from "react-router-dom";

const TONE = { SAFE: "safe", WARNING: "warn", BLOCK: "danger" };
const DECISION_TEXT = { SAFE: "Safe to pay", WARNING: "Proceed with caution", BLOCK: "Payment blocked" };

export const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function EngineBar({ label, score, weight, note, muted }) {
  const tone = score === null ? "none" : score >= 70 ? "danger" : score >= 35 ? "warn" : "safe";
  return (
    <div className="engine-row">
      <div className="engine-head">
        <strong>{label}</strong>
        <span className="engine-score">{muted ? "unavailable" : `${score}/100`}</span>
      </div>
      <div className="bar"><div className={`bar-fill bar-${tone}`} style={{ width: `${muted ? 0 : score}%` }} /></div>
      {(note || (weight !== undefined && !muted)) && (
        <div className="muted small">{weight !== undefined && !muted ? `${Math.round(weight * 100)}% of final score · ` : ""}{note}</div>
      )}
    </div>
  );
}

export function RiskRing({ score, tone }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className={`score-ring-lg ring-tone-${tone}`}>
      <svg viewBox="0 0 110 110" aria-hidden="true">
        <circle cx="55" cy="55" r={r} className="ring-track" />
        <circle cx="55" cy="55" r={r} className="ring-fill" transform="rotate(-90 55 55)" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="ring-center"><strong>{score}</strong><span>/ 100</span></div>
    </div>
  );
}

export default function DecisionCard({ result, onInvestigate, onDna }) {
  const [why, setWhy] = useState(false);
  if (!result) return null;
  const { ml, graph, rules, aggregation, transaction } = result;
  const tone = TONE[result.decision] || "warn";
  const weights = aggregation.weights;
  const factors = ml.available ? ml.topFactors : [];
  const protective = ml.protectiveFactors || [];

  return (
    <article className={`panel decision-card decision-${tone}`} data-testid="decision-card">
      <header className="decision-top">
        <RiskRing score={result.riskScore} tone={tone} />
        <div className="decision-main">
          <div className="decision-badges">
            <span className={`decision-badge badge-${tone}`} data-testid="decision-badge">{result.decision}</span>
            <span className={`level-pill level-${result.riskLevel}`}>{result.riskLevel} RISK</span>
          </div>
          <h3>{DECISION_TEXT[result.decision]}</h3>
          <p className="muted small">
            {inr(transaction.amount)} · {transaction.senderId} → <strong>{transaction.recipientId}</strong>
          </p>
          <p className="decision-summary">{result.summary}</p>
        </div>
      </header>

      <div className="engine-grid">
        <EngineBar label="ML model" score={ml.score} weight={weights.ml} muted={!ml.available}
          note={ml.available ? `${(ml.probability * 100).toFixed(1)}% fraud probability · ${ml.algorithm} ${ml.modelVersion}${ml.mock ? " (MOCK)" : ""}` : ml.error || "ML service offline - rules and graph protect this payment"} />
        <EngineBar label="Graph engine" score={graph.score} weight={weights.graph}
          note={`${graph.connectedBlocked} blocked and ${graph.connectedEntities} flagged connections · ${graph.connectedVictims} victims`} />
        <EngineBar label="Rule engine" score={rules.score} weight={weights.rules}
          note={rules.triggeredRules.length ? `${rules.triggeredRules.length} rules triggered` : "No rules triggered"} />
      </div>

      {ml.available && (
        <div className="prob-block">
          <div className="engine-head">
            <strong>Fraud probability</strong>
            <span className="small">{(ml.probability * 100).toFixed(1)}%</span>
          </div>
          <div className="prob-bar" data-testid="prob-bar">
            <div className={`prob-fill bar-${ml.probability >= (ml.threshold ?? 0.5) ? "danger" : ml.probability >= 0.2 ? "warn" : "safe"}`} style={{ width: `${Math.max(1, ml.probability * 100)}%` }} />
            {ml.threshold !== null && <div className="prob-threshold" style={{ left: `${ml.threshold * 100}%` }} title={`Decision threshold ${ml.threshold}`} />}
          </div>
        </div>
      )}

      {ml.available && result.decision === "SAFE" && protective.length > 0 && (
        <div>
          <strong className="small">What reassured the model</strong>
          <ul className="factor-list" data-testid="top-factors">
            {protective.map((f) => (
              <li key={f.feature} className="factor factor-safe">
                <span className="factor-impact">safe</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {factors.length > 0 && result.decision !== "SAFE" && (
        <div>
          <strong className="small">What the model noticed</strong>
          <ul className="factor-list" data-testid="top-factors">
            {factors.filter((f) => f.impact !== "low").map((f) => (
              <li key={f.feature} className={`factor factor-${f.impact}`}>
                <span className="factor-impact">{f.impact}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="row-actions" style={{ marginTop: 0 }}>
        <button type="button" className="btn btn-primary" onClick={() => setWhy((v) => !v)} aria-expanded={why} data-testid="why-btn">
          {why ? "Hide" : "Why?"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onInvestigate?.(transaction.recipientId)} data-testid="investigate-btn">
          Investigate Network
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onDna?.(result)} data-testid="dna-btn">
          Scam DNA
        </button>
        <Link to="/analyze" className="btn btn-secondary" data-testid="copilot-link">Scam Copilot</Link>
      </div>

      {why && (
        <div className="why-panel" data-testid="why-panel">
          <strong>Why this decision?</strong>
          <ol className="why-list">
            {result.explanation.map((line) => <li key={line}>{line}</li>)}
          </ol>
          {rules.triggeredRules.length > 0 && (
            <div className="chip-row">
              {rules.details.map((r) => <span key={r.id} className="chip rule-chip" title={r.label}>{r.id}</span>)}
            </div>
          )}
          {aggregation.overridesApplied.length > 0 && (
            <div className="alert-banner">
              <strong>Safety overrides applied</strong>
              {aggregation.overridesApplied.map((o) => <div key={o.id} className="small">{o.detail}</div>)}
            </div>
          )}
          <p className="muted small" style={{ margin: 0 }}>
            Final score = {Math.round(weights.ml * 100)}% ML + {Math.round(weights.graph * 100)}% graph + {Math.round(weights.rules * 100)}% rules
            = {aggregation.weightedScore}; thresholds: warn ≥ {aggregation.thresholds.warning}, block ≥ {aggregation.thresholds.block}.
            The decision is made by these engines, not by an LLM.
          </p>
        </div>
      )}
    </article>
  );
}
