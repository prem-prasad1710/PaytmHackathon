import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { fetchTransactionRisk } from "../services/guardianApi";
import { buildTxnContext } from "../utils/txnContext";
import { addPayment, parseAmount } from "../utils/store";
import {
  fetchTrustedContacts,
  requestFamilyApproval,
  getFamilyApproval,
  simulateGuardianOnDevice,
} from "../services/familyApi";

/** Seconds of cooling-off. First-time + high-risk / large first payment get a longer lock. */
const COOLDOWN = { high: 15, elevated: 8, normal: 0 };
const FIRST_PAYEE_LOCK = { high: 45, elevated: 25, normal: 0 };
const LARGE_FIRST_THRESHOLD = 5000; // ₹ — demos LARGE_FIRST_PAYMENT spirit

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
  const [contacts, setContacts] = useState([]);
  const [contactId, setContactId] = useState("mom");
  const [approval, setApproval] = useState(null);
  const [approvalMode, setApprovalMode] = useState("");
  const [asking, setAsking] = useState(false);

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
    fetchTrustedContacts().then((c) => alive && setContacts(c));
    return () => {
      alive = false;
    };
  }, [ctx]);

  // Live poll approval status
  useEffect(() => {
    if (!approval?.id || approval.status !== "pending") return undefined;
    let alive = true;
    const tick = async () => {
      const a = await getFamilyApproval(approval.id);
      if (alive && a) setApproval(a);
    };
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [approval?.id, approval?.status]);

  const level = txn ? combineLevel(textRisk, txn.level) : null;
  const amountNum = parseAmount(amount);
  const largeFirst = Boolean(ctx.new_payee && amountNum >= LARGE_FIRST_THRESHOLD);
  const firstPayeeRisk = Boolean(ctx.new_payee && level && level !== "normal");
  const timeLock = Boolean(firstPayeeRisk || largeFirst || (level === "high" && ctx.new_payee));

  const cooldown = level
    ? timeLock
      ? FIRST_PAYEE_LOCK[level] || COOLDOWN[level]
      : COOLDOWN[level]
    : null;

  const lockReasons = useMemo(() => {
    const reasons = [];
    if (ctx.new_payee) reasons.push("First-time payee — you have not paid this handle before");
    if (largeFirst) reasons.push(`Large first payment (₹${amountNum.toLocaleString("en-IN")}) to a new payee`);
    if (level === "high") reasons.push("High-risk signals on the message or behaviour check");
    else if (level === "elevated") reasons.push("Elevated caution — take a breath before confirming");
    if (txn?.reasons?.length) {
      for (const r of txn.reasons.slice(0, 2)) reasons.push(r.text);
    }
    return [...new Set(reasons)];
  }, [ctx.new_payee, largeFirst, level, amountNum, txn]);

  useEffect(() => {
    if (cooldown === null) return undefined;
    setRemaining(cooldown);
    if (!cooldown) return undefined;
    const id = setInterval(() => setRemaining((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const needsAck = level === "high" || level === "elevated" || timeLock;
  const needsFamily = Boolean(timeLock || level === "high");
  const familyBlocked = approval?.status === "declined";
  // Declined guardian blocks pay; pending waits; no request still allows after cooldown.
  const ready =
    level !== null &&
    remaining === 0 &&
    (!needsAck || ackVerified) &&
    !familyBlocked &&
    (approval?.status !== "pending");

  function handlePay() {
    setProcessing(true);
    addPayment({
      amount: amountNum,
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
        ? `Cooling off · ${remaining}s`
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
        <div>
          {payee}
          {entity && entity !== payee ? ` (${entity})` : ""}
          {ctx.new_payee ? <span className="pill pill-purple" style={{ marginLeft: 8 }}>New payee</span> : null}
        </div>
        <strong style={{ marginTop: "0.75rem" }}>Shield note</strong>
        <div>{summary}</div>
      </div>

      {timeLock && remaining !== null && (
        <div className="time-lock-banner" role="status" data-testid="time-lock">
          <strong>Time-lock active{remaining > 0 ? "" : " complete"}</strong>
          {remaining > 0 ? (
            <div className="time-lock-count">{remaining}s</div>
          ) : (
            <div className="muted small">You can proceed — only if you still trust this payee.</div>
          )}
          <ul className="gp-reasons" style={{ marginTop: "0.5rem" }}>
            {lockReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="muted small" style={{ margin: "0.5rem 0 0" }}>
            Inspired by LARGE_FIRST_PAYMENT / first-time payee controls. After the countdown you may confirm
            deliberately — Shield never auto-pays.
          </p>
        </div>
      )}

      <div className={`guardian-panel level-${level || "loading"}`} role="status">
        <div className="gp-head">
          <strong>Payment behaviour check</strong>
          {txn && <span className="muted small">{txn.model}</span>}
        </div>
        {!txn ? (
          <div className="loading">
            <span className="spinner" aria-hidden="true" /> Analysing amount, payee and timing...
          </div>
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
                {txn.reasons.map((r) => (
                  <li key={r.feature}>{r.text}</li>
                ))}
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


      {needsFamily && (
        <div className="family-ask panel-inset" data-testid="family-ask" style={{ maxWidth: 480, margin: "0 auto 1rem", textAlign: "left" }}>
          <strong>Ask a trusted contact</strong>
          <p className="muted small" style={{ margin: "0.35rem 0 0.65rem" }}>
            High-risk / time-locked payments can wait for Mom, Sister or Brother to approve. Works offline with a simulated guardian.
          </p>
          {!approval && (
            <>
              <label className="small">
                Trusted contact
                <select value={contactId} onChange={(e) => setContactId(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }}>
                  {(contacts.length ? contacts : [{ id: "mom", name: "Priya Prasad (Mom)" }]).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <div className="row-actions" style={{ marginTop: "0.65rem" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={asking}
                  onClick={async () => {
                    setAsking(true);
                    const out = await requestFamilyApproval({
                      contactId,
                      amount,
                      payee,
                      entity,
                      risk: level === "high" ? "High Risk" : textRisk || "Caution",
                      summary,
                      payerNote: `Please check this ${amount} payment to ${payee}`,
                    });
                    setApproval(out.approval);
                    setApprovalMode(out.mode);
                    setAsking(false);
                  }}
                >
                  {asking ? "Sending…" : "Send approval request"}
                </button>
              </div>
            </>
          )}
          {approval && (
            <div className="stack" style={{ gap: "0.5rem" }}>
              <div className="chip-row">
                <span className={`chip ${approval.status === "approved" ? "" : "chip-bad"}`}>Status: {approval.status}</span>
                <span className="chip">{approval.contact?.name}</span>
                <span className="chip">{approvalMode || (approval.offlineSim ? "offline" : "server")}</span>
              </div>
              {approval.status === "pending" && (
                <>
                  <p className="muted small" style={{ margin: 0 }}>Waiting for guardian… Open their inbox or simulate on this device:</p>
                  <div className="row-actions">
                    <Link className="btn btn-secondary" to={`/family${approval.id ? `?id=${approval.id}` : ""}`}>Open guardian inbox</Link>
                    <button type="button" className="btn btn-secondary" onClick={async () => {
                      const out = await simulateGuardianOnDevice(approval.id, "declined");
                      setApproval(out.approval);
                    }}>Simulate decline</button>
                    <button type="button" className="btn btn-safe" onClick={async () => {
                      const out = await simulateGuardianOnDevice(approval.id, "approved");
                      setApproval(out.approval);
                    }}>Simulate approve</button>
                  </div>
                </>
              )}
              {approval.status === "declined" && (
                <div className="error-banner" style={{ margin: 0 }}>Guardian declined. Payment stays locked. Call 1930 if you already shared a PIN.</div>
              )}
              {approval.status === "approved" && (
                <div className="alert-banner" style={{ margin: 0 }}>Guardian approved. You may confirm only if you still trust this payee.</div>
              )}
              {approval.decisionNote && <p className="muted small">{approval.decisionNote}</p>}
            </div>
          )}
        </div>
      )}

      <div className="row-actions" style={{ justifyContent: "center" }}>
        <button
          className={`btn ${level === "high" ? "btn-danger" : "btn-safe"}`}
          onClick={handlePay}
          disabled={!ready || processing}
          data-testid="confirm-pay-btn"
        >
          {label}
        </button>
        <Link className="btn btn-secondary" to="/analyze">
          Cancel
        </Link>
      </div>
    </section>
  );
}
