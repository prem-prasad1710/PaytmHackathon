import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

const CHECKS = [
  "Saved/old number pe call kiya",
  "Person ne secret family question sahi jawab diya",
  "UPI ID / name match karta hai",
];

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState([]);

  const amount = location.state?.amount || "₹5,000";
  const payee = location.state?.payee || "Unknown UPI";
  const summary = location.state?.summary || "Verify before paying.";

  function toggle(item) {
    setChecked((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  }

  const allDone = checked.length === CHECKS.length;

  function continueAfterVerify() {
    navigate("/confirm-pay", {
      state: {
        amount,
        payee,
        summary: "Verify complete. Ab carefully pay karo.",
        warned: false,
      },
    });
  }

  return (
    <section className="panel stack">
      <div>
        <span className="eyebrow">Verify First</span>
        <h2 style={{ marginTop: "0.5rem" }}>Identity check</h2>
        <p className="muted">
          Caution case: payment se pehle ye checks complete karo. Demo me tick karke continue
          kar sakte ho.
        </p>
      </div>

      <div className="feature">
        <strong>Paying</strong>
        <div>
          {amount} → {payee}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {summary}
        </p>
      </div>

      <div className="stack">
        {CHECKS.map((item) => (
          <label key={item} className="feature" style={{ display: "flex", gap: "0.7rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={checked.includes(item)}
              onChange={() => toggle(item)}
            />
            <span>{item}</span>
          </label>
        ))}
      </div>

      <div className="row-actions">
        <button className="btn btn-safe" disabled={!allDone} onClick={continueAfterVerify}>
          Verified — Continue to Pay
        </button>
        <Link className="btn btn-secondary" to="/analyze">
          Cancel
        </Link>
      </div>
    </section>
  );
}
