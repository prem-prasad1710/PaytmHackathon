import { Link, useLocation } from "react-router-dom";
import ReportForm from "../components/ReportForm.jsx";
import { HELPLINES } from "../data/threatSeed";

function guessType(entity = "") {
  if (/^https?:|\./.test(entity) && !entity.includes("@")) return "link";
  if (/^\d{10}$/.test(entity)) return "mobile";
  if (entity.includes("@")) return "upi";
  return "message";
}

export default function Blocked() {
  const location = useLocation();
  const summary = location.state?.summary || "Ye payment block kar diya gaya.";
  const reported = Boolean(location.state?.reported);
  const entity = location.state?.entity || "";

  if (reported) {
    return (
      <section className="panel stack">
        <div>
          <span className="eyebrow">Community report</span>
          <h2 style={{ margin: "0.5rem 0 0.25rem" }}>Report this scam</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Your report warns other Paytm users and updates the live threat map. {summary}
          </p>
        </div>
        <ReportForm
          initial={{
            entity,
            type: guessType(entity),
            category: location.state?.category,
          }}
        />
      </section>
    );
  }

  return (
    <section className="mock-card">
      <div
        className="mock-success"
        style={{ background: "rgba(220, 38, 38, 0.12)", color: "#dc2626" }}
        aria-hidden="true"
      >
        ✕
      </div>
      <h1>Payment Blocked</h1>
      <p className="lead">High Risk detected. Link / QR / UPI PIN mat use karo.</p>

      <div className="feature" style={{ maxWidth: 380, margin: "1.25rem auto", textAlign: "left" }}>
        <strong>Shield note</strong>
        <div>{summary}</div>
        <strong style={{ marginTop: "0.75rem", display: "block" }}>Already shared a PIN / OTP or paid?</strong>
        <div>
          Call <a href={HELPLINES[0].href}><strong>1930</strong></a> right away and tell your bank to freeze the
          transaction. The first hour matters most.
        </div>
      </div>

      <div className="row-actions" style={{ justifyContent: "center" }}>
        <Link className="btn btn-danger" to="/blocked" state={{ ...location.state, reported: true }}>
          Report this scam
        </Link>
        <Link
          className="btn btn-secondary"
          to="/report-pack"
          state={{ source: "blocked", summary, payee: entity, amount: location.state?.amount, risk: location.state?.risk }}
        >
          Report pack →
        </Link>
        <Link className="btn btn-primary" to="/analyze">
          Check another
        </Link>
        <Link className="btn btn-secondary" to="/">
          Home
        </Link>
      </div>
    </section>
  );
}
