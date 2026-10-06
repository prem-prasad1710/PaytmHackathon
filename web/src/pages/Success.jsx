import { Link, useLocation } from "react-router-dom";

export default function Success() {
  const location = useLocation();
  const amount = location.state?.amount || "₹842";
  const payee = location.state?.payee || "Official biller";
  const summary = location.state?.summary || "Payment completed in demo.";
  const warned = Boolean(location.state?.warned);

  return (
    <section className="mock-card">
      <div className="mock-success" aria-hidden="true">
        ✓
      </div>
      <h1>Payment Successful</h1>
      <p className="lead">Mock demo only — no real money moved.</p>

      {warned && (
        <div className="error-banner" style={{ marginBottom: "1rem" }}>
          Completed via Continue Anyway (Caution). Real app me extra verification hogi.
        </div>
      )}

      <div className="feature" style={{ maxWidth: 360, margin: "1.25rem auto", textAlign: "left" }}>
        <strong>Amount</strong>
        <div>{amount}</div>
        <strong style={{ marginTop: "0.75rem" }}>Paid to</strong>
        <div>{payee}</div>
        <strong style={{ marginTop: "0.75rem" }}>Txn ID</strong>
        <div>DEMO{Date.now().toString().slice(-8)}</div>
        <strong style={{ marginTop: "0.75rem" }}>Shield note</strong>
        <div>{summary}</div>
      </div>

      <div className="row-actions" style={{ justifyContent: "center" }}>
        <Link className="btn btn-primary" to="/analyze">
          Check another message
        </Link>
        <Link className="btn btn-secondary" to="/">
          Back to Home
        </Link>
      </div>
    </section>
  );
}
