import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchModelMetrics } from "../services/guardianApi";
import { fetchOverview } from "../services/fraudApi";

const pct = (n) => `${(n * 100).toFixed(1)}%`;

export default function ModelCard() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const [fraud, setFraud] = useState(null);

  useEffect(() => {
    fetchModelMetrics().then(setMetrics).catch((e) => setError(e.message));
    fetchOverview().then(setFraud).catch(() => setFraud(null));
  }, []);

  const ft = fraud?.metrics?.test;

  const b = metrics?.binary;
  const cm = b?.confusion_matrix;

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <span className="eyebrow">Model card</span>
          <h2 style={{ margin: "0.5rem 0 0.25rem" }}>How the fraud model works</h2>
          <p className="muted" style={{ margin: 0 }}>
            Transparent by design: what is trained, how it is tested, and where it can be wrong.
          </p>
        </div>

        <div className="two-col">
          <div className="feature">
            <strong>Message scam classifier</strong>
            TF-IDF word and character n-grams plus link, UPI-ID, amount and tone signals, fed into logistic
            regression. Every prediction is explainable word by word. A second head names the scam type.
          </div>
          <div className="feature">
            <strong>Payment anomaly detector</strong>
            Isolation Forest over amount vs your usual spend, new payee, time of day, payment velocity, community
            complaints and collect requests. It powers the Payment Guardian.
          </div>
        </div>
      </section>

      <section className="panel stack" data-testid="fraud-model-summary">
        <div className="section-head">
          <div>
            <span className="eyebrow">Payment fraud model</span>
            <h3 style={{ margin: 0 }}>XGBoost + graph + rules</h3>
          </div>
          <Link to="/lab" className="link">Open Fraud Lab →</Link>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Scores each payment from 39 point-in-time features (recipient age, payment velocity, complaints, device sharing, fund movement, network links).
          A graph engine and a rule engine run alongside it, and a risk aggregator makes the decision. An LLM never decides.
        </p>
        {ft ? (
          <div className="stat-grid">
            <div className="stat"><strong>{pct(ft.precision)}</strong><span>Precision</span></div>
            <div className="stat"><strong>{pct(ft.recall)}</strong><span>Recall</span></div>
            <div className="stat"><strong>{ft.prAuc.toFixed(3)}</strong><span>PR-AUC</span></div>
            <div className="stat"><strong>{fraud.model?.modelVersion}</strong><span>Model version</span></div>
          </div>
        ) : (
          <div className="alert-banner small">Start the ML service (<code>npm run dev:ml</code>) to load this model's live metrics.</div>
        )}
        <div className="alert-banner">
          <strong>Honest limits</strong>
          <div className="small" style={{ marginTop: "0.3rem" }}>
            Trained and tested on a simulated payment ledger, which is easier than real traffic. Real labelled fraud is needed before these numbers can be trusted in production.
          </div>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          Model service is offline. Start it with <code>npm run dev:ml</code> to see live metrics.
        </div>
      )}

      {b && (
        <section className="panel stack">
          <h3 style={{ margin: 0 }}>Held-out evaluation</h3>
          <div className="stat-grid">
            <div className="stat"><strong>{pct(b.precision)}</strong><span>Precision</span></div>
            <div className="stat"><strong>{pct(b.recall)}</strong><span>Recall</span></div>
            <div className="stat"><strong>{pct(b.f1)}</strong><span>F1 score</span></div>
            <div className="stat"><strong>{b.roc_auc.toFixed(3)}</strong><span>ROC-AUC</span></div>
          </div>

          <div className="two-col">
            <div>
              <strong>Confusion matrix</strong>
              <table className="cm">
                <thead>
                  <tr><th /><th>Pred. legit</th><th>Pred. scam</th></tr>
                </thead>
                <tbody>
                  <tr><th>Actually legit</th><td className="ok">{cm[0][0]}</td><td className="bad">{cm[0][1]}</td></tr>
                  <tr><th>Actually scam</th><td className="bad">{cm[1][0]}</td><td className="ok">{cm[1][1]}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <strong>Scam-type accuracy</strong>
              <div className="big-num">{pct(metrics.category_accuracy)}</div>
              <p className="muted small" style={{ marginTop: 0 }}>
                Across 12 scam categories on unseen wording. This is the weakest part of the model, so the type
                label only shows when it is at least 45% confident.
              </p>
            </div>
          </div>

          <div className="alert-banner">
            <strong>Honest limits</strong>
            <div className="small" style={{ marginTop: "0.3rem" }}>{metrics.dataset.note}</div>
            <div className="small" style={{ marginTop: "0.3rem" }}>
              {metrics.dataset.evaluated_samples?.toLocaleString("en-IN")} messages evaluated across{" "}
              {metrics.dataset.cv_folds} folds, {metrics.dataset.templates_total} templates.
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>How the final score is decided</h3>
        <ol className="steps-list">
          <li>The rule engine (or Grok, when configured) gives a scenario-based verdict.</li>
          <li>The ML model gives an independent scam probability and the words behind it.</li>
          <li>The two are blended safety-first. If no known template matches, the ML model leads.</li>
          <li>Community complaints on a UPI ID or number can only raise the risk, never lower it.</li>
        </ol>
      </section>
    </div>
  );
}
