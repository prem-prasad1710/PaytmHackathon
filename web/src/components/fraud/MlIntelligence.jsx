const pct = (n, d = 1) => (typeof n === "number" ? `${(n * 100).toFixed(d)}%` : "-");

function CompareRow({ label, a, b, fmt = pct, lowerBetter = false }) {
  const better = a === undefined || b === undefined ? null : lowerBetter ? (a < b ? "a" : b < a ? "b" : null) : a > b ? "a" : b > a ? "b" : null;
  return (
    <tr>
      <th>{label}</th>
      <td className={better === "a" ? "win" : ""}>{fmt(a)}</td>
      <td className={better === "b" ? "win" : ""}>{fmt(b)}</td>
    </tr>
  );
}

export default function MlIntelligence({ overview }) {
  if (!overview) return <section className="panel muted">Loading ML intelligence…</section>;

  if (!overview.mlAvailable || !overview.metrics) {
    return (
      <section className="panel stack" data-testid="ml-offline">
        <div><span className="eyebrow">ML Intelligence</span><h3 style={{ margin: 0 }}>ML service offline</h3></div>
        <div className="error-banner">
          The Python model service is not reachable ({overview.health?.reason || "no response"}). Payments are still protected by the rule and graph engines.
          Start it with <code>npm run dev:ml</code> (train first with <code>npm run train:ml</code> if there is no model).
        </div>
      </section>
    );
  }

  const m = overview.metrics;
  const t = m.test;
  const lr = m.comparison?.logisticRegression;
  const xgb = m.comparison?.primary;
  const mon = overview.monitoring;
  const mlMon = overview.mlMonitoring;
  const importance = (overview.importance || []).slice(0, 8);
  const maxImp = importance[0]?.meanAbsContribution || 1;
  const cm = t.confusionMatrix;

  return (
    <section className="panel stack" data-testid="ml-intelligence">
      <div className="ml-head">
        <div>
          <span className="eyebrow">ML Intelligence</span>
          <h3 style={{ margin: 0 }}>{m.algorithm} fraud model <span className="ver-pill" data-testid="model-version">{m.modelVersion}</span></h3>
        </div>
        <span className="muted small">Trained {new Date(overview.model?.trainedAt || m.evaluatedAt).toLocaleDateString()} · {overview.model?.features} features · {overview.model?.totalSamples?.toLocaleString("en-IN")} transactions</span>
      </div>

      <div className="stat-grid" data-testid="ml-stats">
        <div className="stat"><strong>{mon.prediction_count.toLocaleString("en-IN")}</strong><span>Transactions scored (this session)</span></div>
        <div className="stat"><strong>{pct(t.precision)}</strong><span>Precision</span></div>
        <div className="stat"><strong>{pct(t.recall)}</strong><span>Recall</span></div>
        <div className="stat"><strong>{t.prAuc.toFixed(3)}</strong><span>PR-AUC</span></div>
        <div className="stat"><strong>{pct(t.falsePositiveRate, 2)}</strong><span>False-positive rate</span></div>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Metrics are measured on the chronologically newest {pct(m.split.test.rows / (m.split.train.rows + m.split.validation.rows + m.split.test.rows), 0)} of
        the dataset ({t.samples.toLocaleString("en-IN")} transactions, {t.fraudSamples} fraud), never used for training or tuning. Read from <code>ml/evaluation/metrics.json</code>.
      </p>

      <div className="alert-banner">
        <strong>Read these numbers with care</strong>
        <div className="small" style={{ marginTop: "0.3rem" }}>
          {m.dataset?.note || "The dataset is synthetic."} Real-world precision at a 1% fraud rate would be about {pct(t.precisionIfFraudRate1pct, 0)} (prevalence-adjusted),
          and real fraudsters adapt, so expect lower scores in production.
        </div>
      </div>

      <div className="two-col">
        <div data-testid="model-comparison">
          <strong>Logistic Regression vs XGBoost</strong>
          <table className="cm compare">
            <thead><tr><th /><th>Logistic</th><th>XGBoost</th></tr></thead>
            <tbody>
              <CompareRow label="Precision" a={lr?.precision} b={xgb?.precision} />
              <CompareRow label="Recall" a={lr?.recall} b={xgb?.recall} />
              <CompareRow label="F1" a={lr?.f1} b={xgb?.f1} />
              <CompareRow label="PR-AUC" a={lr?.prAuc} b={xgb?.prAuc} fmt={(v) => v?.toFixed(3)} />
              <CompareRow label="False-positive rate" a={lr?.falsePositiveRate} b={xgb?.falsePositiveRate} fmt={(v) => pct(v, 2)} lowerBetter />
            </tbody>
          </table>
          <p className="muted small">Both trained on the same data and scored on the same held-out test set.</p>
        </div>
        <div>
          <strong>Confusion matrix (test)</strong>
          <table className="cm">
            <thead><tr><th /><th>Pred. legit</th><th>Pred. fraud</th></tr></thead>
            <tbody>
              <tr><th>Actually legit</th><td className="ok">{cm.tn.toLocaleString("en-IN")}</td><td className="bad">{cm.fp}</td></tr>
              <tr><th>Actually fraud</th><td className="bad">{cm.fn}</td><td className="ok">{cm.tp}</td></tr>
            </tbody>
          </table>
          <p className="muted small">Inference latency (model only, incl. explanation): mean {m.latency?.meanMs} ms, p95 {m.latency?.p95Ms} ms.</p>
        </div>
      </div>

      <div className="two-col">
        <div data-testid="feature-importance">
          <strong>What the model relies on (SHAP)</strong>
          <ul className="imp-list">
            {importance.map((f) => (
              <li key={f.feature}>
                <span className="imp-label">{f.label}</span>
                <span className="imp-bar"><span style={{ width: `${(f.meanAbsContribution / maxImp) * 100}%` }} /></span>
              </li>
            ))}
          </ul>
        </div>
        <div data-testid="monitoring">
          <strong>Live monitoring</strong>
          <div className="mon-grid">
            <div><span className="muted small">prediction_count</span><b>{mon.prediction_count}</b></div>
            <div><span className="muted small">fraud_prediction_count</span><b>{mon.fraud_prediction_count}</b></div>
            <div><span className="muted small">average_risk_score</span><b>{mon.average_risk_score ?? "-"}</b></div>
            <div><span className="muted small">high_risk_rate</span><b>{mon.high_risk_rate === null ? "-" : pct(mon.high_risk_rate)}</b></div>
            <div><span className="muted small">model_latency (p95)</span><b>{mlMon?.model_latency?.p95Ms ?? "-"} ms</b></div>
            <div><span className="muted small">end-to-end (p95)</span><b>{mon.end_to_end_latency_ms.p95 ?? "-"} ms</b></div>
          </div>
        </div>
      </div>
    </section>
  );
}
