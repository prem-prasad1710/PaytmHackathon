import { Link } from "react-router-dom";
import { TRENDING_ALERTS } from "../data/threatSeed";
import {
  computeSafetyStats,
  getChecks,
  getLocalReports,
  getPayments,
  useStoreValue,
} from "../utils/store";
import { riskColor } from "../utils/riskStyles";

const KIND_LABEL = { qr: "QR", message: "Message", screenshot: "Screenshot" };

function ScoreRing({ score, empty }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = empty ? "var(--muted)" : score >= 75 ? "var(--safe)" : score >= 55 ? "var(--caution)" : "var(--danger)";
  const shown = empty ? 0 : score;
  return (
    <div
      className="score-ring-lg"
      role="img"
      aria-label={empty ? "Safety score not available yet. Run a check to start." : `Safety score ${score} out of 100`}
    >
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} className="ring-track" />
        <circle
          cx="60" cy="60" r={r} className="ring-fill" stroke={color}
          strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="ring-center">
        <strong>{empty ? "–" : score}</strong>
        <span>{empty ? "Run a check to start" : "Safety score"}</span>
      </div>
    </div>
  );
}

function timeAgo(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export default function Home() {
  const checks = useStoreValue(getChecks);
  const reports = useStoreValue(getLocalReports);
  const payments = useStoreValue(getPayments);
  const stats = computeSafetyStats(checks, reports, payments);

  return (
    <div className="stack">
      <section className="hero hero-split">
        <div>
          <span className="eyebrow">QR · Message · Screenshot · Payment Guardian</span>
          <h1>Pay with confidence.</h1>
          <p className="lead">
            Payment se pehle ek smart second. Scan a QR, paste an SMS or upload a screenshot. Shield checks it
            with rules, a trained ML model and community reports.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/analyze" state={{ tab: "qr" }}>▣ Scan a QR</Link>
            <Link className="btn btn-secondary" to="/analyze" state={{ tab: "message" }}>✉ Check a message</Link>
            <Link className="btn btn-secondary" to="/analyze" state={{ tab: "screenshot" }}>🖼 Screenshot</Link>
            <Link className="btn btn-secondary" to="/lab">⚡ Fraud Lab</Link>
          </div>
        </div>
        <ScoreRing score={stats.score} empty={stats.checks === 0 && stats.reports === 0 && payments.length === 0} />
      </section>

      <section className="stat-grid" aria-label="Your protection">
        <div className="stat"><strong>{stats.checks}</strong><span>Checks done</span></div>
        <div className="stat stat-danger"><strong>{stats.blocked}</strong><span>Scams caught</span></div>
        <div className="stat"><strong>{stats.caution}</strong><span>Caution flags</span></div>
        <div className="stat stat-safe">
          <strong>₹{stats.protectedAmount.toLocaleString("en-IN")}</strong>
          <span>Money protected</span>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Trending scam alerts</h2>
          <Link to="/threats" className="link">Open threat map →</Link>
        </div>
        <div className="alert-grid">
          {TRENDING_ALERTS.map((a) => (
            <article key={a.id} className={`trend trend-${a.severity}`}>
              <span className="trend-tag">{a.severity === "high" ? "Rising" : "Watch"}</span>
              <h3>{a.title}</h3>
              <p>{a.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Recent checks</h2>
          <Link to="/history" className="link">All history →</Link>
        </div>
        {checks.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nothing checked yet. Scan a QR or paste a message. Results are saved on this device only.
          </p>
        ) : (
          <ul className="recent">
            {checks.slice(0, 4).map((c) => (
              <li key={c.id}>
                <span className="dot-risk" style={{ background: riskColor(c.risk) }} aria-hidden="true" />
                <div className="grow">
                  <div className="recent-top">
                    <strong>{c.risk}</strong>
                    <span className="muted small">{KIND_LABEL[c.kind] || "Check"} · {timeAgo(c.at)}</span>
                  </div>
                  <div className="muted small ellipsis">{c.input}</div>
                </div>
                <span className="recent-score">{c.score}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="feature-grid" id="how">
        <div className="feature"><strong>▣ QR Guard</strong>Reads UPI payloads, spots collect-requests and "receive money" traps.</div>
        <div className="feature"><strong>🧠 ML + Rules</strong>Explainable scoring with highlighted risky words.</div>
        <Link to="/lab" className="feature feature-link"><strong>⚡ Fraud Lab</strong>XGBoost + network graph + rules score every payment, live.</Link>
        <div className="feature"><strong>🛡 Payment Guardian</strong>Cooling-off timer when amount, payee or timing looks unusual.</div>
        <div className="feature"><strong>🗺 Community map</strong>Live reports by state feed back into detection.</div>
      </section>
    </div>
  );
}
