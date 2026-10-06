const pctOf = (w, total) => `${Math.round((w / total) * 100)}%`;

export default function LabHero({ overview, onReset }) {
  const w = overview?.config?.weights;
  const total = w ? w.mlWeight + w.graphWeight + w.ruleWeight : 1;
  const mlOn = overview?.mlAvailable;
  const ledger = overview?.ledger;

  return (
    <section className="lab-hero" data-testid="lab-hero">
      <div className="lab-hero-copy">
        <span className="lab-kicker">Fraud Lab</span>
        <h2>Three engines. One decision.</h2>
        <p>
          Every payment is scored by an XGBoost model, a network graph and a rule engine. A risk aggregator makes the call; an LLM never
          does. It can only explain the result.
        </p>
        <div className="lab-status">
          <span className={`status-pill ${mlOn ? "on" : "off"}`} data-testid="ml-status">
            <i />{overview ? (mlOn ? `ML online · ${overview.model?.modelVersion || overview.health?.modelVersion || ""}` : "ML offline · rules + graph active") : "Connecting…"}
          </span>
          {ledger && <span className="status-pill neutral">{ledger.accounts} accounts · {ledger.blockedAccounts} blocked</span>}
          {ledger && <span className="status-pill neutral">{ledger.events.toLocaleString("en-IN")} ledger events</span>}
          <button type="button" className="status-pill link-pill" onClick={onReset} data-testid="reset-btn">↺ Reset demo</button>
        </div>
      </div>

      <div className="pipe" aria-label="Decision pipeline">
        <div className="pipe-node pipe-in"><b>Payment</b><small>amount · sender · recipient · device</small></div>
        <span className="pipe-arrow" aria-hidden="true">›</span>
        <div className="pipe-stack">
          <div className="pipe-node pipe-ml"><b>ML model</b><small>XGBoost{w ? ` · ${pctOf(w.mlWeight, total)}` : ""}</small></div>
          <div className="pipe-node pipe-graph"><b>Graph</b><small>network risk{w ? ` · ${pctOf(w.graphWeight, total)}` : ""}</small></div>
          <div className="pipe-node pipe-rules"><b>Rules</b><small>known patterns{w ? ` · ${pctOf(w.ruleWeight, total)}` : ""}</small></div>
        </div>
        <span className="pipe-arrow" aria-hidden="true">›</span>
        <div className="pipe-node pipe-agg"><b>Risk aggregator</b><small>0-100 + safety overrides</small></div>
        <span className="pipe-arrow" aria-hidden="true">›</span>
        <div className="pipe-out">
          <span className="decision-badge badge-safe">SAFE</span>
          <span className="decision-badge badge-warn">WARNING</span>
          <span className="decision-badge badge-danger">BLOCK</span>
        </div>
      </div>
    </section>
  );
}
