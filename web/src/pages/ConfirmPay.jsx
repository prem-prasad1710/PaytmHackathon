import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { fetchTransactionRisk } from "../services/guardianApi";
import { buildTxnContext } from "../utils/txnContext";
import { addPayment, parseAmount } from "../utils/store";

const COOLDOWN = { high: 15, elevated: 8, normal: 0 };

function combineLevel(textRisk, anomalyLevel) {
  if (textRisk === "High Risk" || anomalyLevel === "high") return "high";
  if (textRisk === "Caution" || anomalyLevel === "elevated") return "elevated";
  return "normal";
}

export default function ConfirmPay() {
  const location = useLocation();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [txn, setTxn] = useState(null);
  const [ackVerified, setAckVerified] = useState(false);
  const [remaining, setRemaining] = useState(null);

  const amount = location.state?.amount || "₹842";
  const payee = location.state?.payee || location.state?.note || "Official biller";
  const entity = location.state?.entity || "";
  const summary = location.state?.summary || "Safe payment flow (demo).";
  const warned = Boolean(location.state?.warned);
  const textRisk = location.state?.risk;

  const ctx = useMemo(
    () => buildTxnContext({ amount, payee: entity || payee, collect: location.state?.collect }),
    [amount, payee, entity, location.state?.collect]
  );

  useEffect(() => {
    let alive = true;
    fetchTransactionRisk(ctx).then((r) => alive && setTxn(r));
    return () => {
      alive = false;
    };
  }, [ctx]);

  const level = txn ? combineLevel(textRisk, txn.level) : null;
  const cooldown = level ? COOLDOWN[level] : null;

  useEffect(() => {
    if (cooldown === null) return undefined;
    setRemaining(cooldown);
    if (!cooldown) return undefined;
    const id = setInterval(() => setRemaining((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const needsAck = level === "high" || level === "elevated";
  const ready = level !== null && remaining === 0 && (!needsAck || ackVerified);

  function handlePay() {
    setProcessing(true);
    addPayment({
      amount: parseAmount(amount),
      payee: entity || payee,
      risk: level === "high" ? "High Risk" : textRisk,
    });
    window.setTimeout(() => {
      navigate("/success", { replace: true, state: { amount, payee, summary, warned } });
    }, 700);
  }

  const label =
    level === null
      ? "Checking payment..."
      : remaining > 0
        ? `Wait ${remaining}s`
        : processing
          ? "Paying..."
          : "Confirm & Pay";

  return (
    <section className="mock-card">
      <span className="eyebrow">Payment Guardian</span>
      <h1>Pay now?</h1>
      <p className="lead">
        {warned
          ? "Shield marked this as Caution. Take a moment before you continue."
          : "Last safety check before the money leaves your account."}
      </p>

      <div className="feature" style={{ maxWidth: 420, margin: "1.25rem auto", textAlign: "left" }}>
        <strong>Amount</strong>
        <div>{amount}</div>
        <strong style={{ marginTop: "0.75rem" }}>Pay to</strong>
        <div>{payee}{entity && entity !== payee ? ` (${entity})` : ""}</div>
        <strong style={{ marginTop: "0.75rem" }}>Shield note</strong>
        <div>{summary}</div>
      </div>

      <div className={`guardian-panel level-${level || "loading"}`} role="status">
        <div className="gp-head">
          <strong>Payment behaviour check</strong>
          {txn && <span className="muted small">{txn.model}</span>}
        </div>
        {!txn ? (
          <div className="loading"><span className="spinner" aria-hidden="true" /> Analysing amount, payee and timing...</div>
        ) : (
          <>
            <div className="gp-meter" title={`Anomaly score ${txn.anomaly_score}`}>
              <span style={{ width: `${Math.max(3, txn.anomaly_score)}%` }} />
            </div>
            <div className="gp-meta">
              <span>Unusualness {Math.round(txn.anomaly_score)}/100</span>
              <span className={`pill pill-${level}`}>
                {level === "high" ? "High caution" : level === "elevated" ? "Slow down" : "Looks normal"}
              </span>
            </div>
            {txn.reasons?.length > 0 ? (
              <ul className="gp-reasons">
                {txn.reasons.map((r) => <li key={r.feature}>{r.text}</li>)}
              </ul>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                {level === "normal"
                  ? "Amount, payee and timing match your usual behaviour."
                  : `Payment pattern looks normal, but the message that led here was flagged ${textRisk || "for caution"}.`}
              </p>
            )}
          </>
        )}
      </div>

      {needsAck && (
        <label className="ack">
          <input type="checkbox" checked={ackVerified} onChange={(e) => setAckVerified(e.target.checked)} />
          <span>
            I have confirmed this payee through a trusted channel (saved number, in person or the official app).
          </span>
        </label>
      )}

      {level === "high" && (
        <div className="error-banner" style={{ textAlign: "left", marginBottom: "1rem" }}>
          High-risk payment: genuine buyers, banks and government offices never ask you to pay to receive money.
        </div>
      )}

      <div className="row-actions" style={{ justifyContent: "center" }}>
        <button className={`btn ${level === "high" ? "btn-danger" : "btn-safe"}`} onClick={handlePay} disabled={!ready || processing}>
          {label}
        </button>
        <Link className="btn btn-secondary" to="/analyze">
          Cancel
        </Link>
      </div>
    </section>
  );
}
