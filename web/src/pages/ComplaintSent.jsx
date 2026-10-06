import { Link, useLocation } from "react-router-dom";

export default function ComplaintSent() {
  const location = useLocation();
  const payload = location.state?.payload;

  if (!payload) {
    return (
      <section className="mock-card">
        <h1>No complaint selected</h1>
        <p className="lead">Pehle History se transaction select karke complaint raise karo.</p>
        <Link className="btn btn-primary" to="/history">
          Go to History
        </Link>
      </section>
    );
  }

  const { recipient, txn, complaintId, subject, body, sentAt } = payload;

  return (
    <section className="mock-card" style={{ textAlign: "left" }}>
      <div className="mock-success" style={{ margin: "0 auto 1rem" }} aria-hidden="true">
        ✓
      </div>
      <h1 style={{ textAlign: "center" }}>Complaint Sent</h1>
      <p className="lead" style={{ textAlign: "center" }}>
        Demo complaint authorised desk ko bhej di gayi (auto-filled).
      </p>

      <div className="feature" style={{ marginBottom: "1rem" }}>
        <strong>To</strong>
        <div>
          {recipient.name} &lt;{recipient.email}&gt;
        </div>
        <strong style={{ marginTop: "0.75rem" }}>Complaint ID</strong>
        <div>{complaintId}</div>
        <strong style={{ marginTop: "0.75rem" }}>Sent at</strong>
        <div>{new Date(sentAt).toLocaleString()}</div>
        <strong style={{ marginTop: "0.75rem" }}>Subject</strong>
        <div>{subject}</div>
      </div>

      <div className="feature" style={{ marginBottom: "1rem" }}>
        <strong>Auto-filled transaction</strong>
        <div>Txn: {txn.id}</div>
        <div>
          {txn.amount} → {txn.payeeName}
        </div>
        <div className="muted">
          {txn.date} {txn.time} · {txn.upiId || txn.mobile || "N/A"}
        </div>
      </div>

      <div className="feature" style={{ marginBottom: "1.25rem", whiteSpace: "pre-wrap" }}>
        <strong>Message preview</strong>
        <div style={{ marginTop: "0.5rem", fontSize: "0.92rem" }}>{body}</div>
      </div>

      <div className="row-actions" style={{ justifyContent: "center" }}>
        <Link className="btn btn-primary" to="/history">
          Back to History
        </Link>
        <Link className="btn btn-secondary" to="/">
          Home
        </Link>
      </div>
    </section>
  );
}
