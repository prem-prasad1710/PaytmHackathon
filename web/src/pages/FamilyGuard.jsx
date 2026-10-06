import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { decideFamilyApproval, fetchPendingApprovals, getFamilyApproval } from "../services/familyApi";
import StatusBadge from "../components/StatusBadge.jsx";

export default function FamilyGuard() {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const focusId = routeId || params.get("id") || "";
  const [pending, setPending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [focus, setFocus] = useState(null);
  const [mode, setMode] = useState("offline");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const data = await fetchPendingApprovals();
    setPending(data.pending);
    setRecent(data.recent);
    setMode(data.mode);
    if (focusId) {
      const a = await getFamilyApproval(focusId);
      setFocus(a);
    } else if (data.pending[0]) {
      setFocus(data.pending[0]);
    }
  }, [focusId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  async function decide(decision) {
    if (!focus) return;
    setBusy(decision);
    setError("");
    try {
      const out = await decideFamilyApproval(focus.id, { decision, note });
      setFocus(out.approval);
      setMode(out.mode);
      await refresh();
    } catch (e) {
      setError(e.message || "Could not save decision");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="section-head">
          <div>
            <span className="eyebrow">Trusted contact</span>
            <h2 style={{ margin: 0 }}>Family Guardian inbox</h2>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              Approve or decline risky payments for someone who trusts you. Demo only — no real push/SMS.
            </p>
          </div>
          <StatusBadge mode={mode === "server" ? "server" : "offline"} detail={mode === "server" ? "Live API inbox" : "On-device simulated inbox"} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="family-layout">
          <aside className="family-list">
            <strong className="small">Pending ({pending.length})</strong>
            {pending.length === 0 && <p className="muted small">No pending requests.</p>}
            {pending.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`family-item ${focus?.id === a.id ? "active" : ""}`}
                onClick={() => setFocus(a)}
              >
                <strong>{a.payment?.amount}</strong>
                <span className="muted small">{a.payment?.payee}</span>
                <span className="muted small">from payer → {a.contact?.name}</span>
              </button>
            ))}
            <strong className="small" style={{ marginTop: "0.75rem" }}>Recent</strong>
            {recent.filter((a) => a.status !== "pending").slice(0, 5).map((a) => (
              <button key={a.id} type="button" className="family-item" onClick={() => setFocus(a)}>
                <strong>{a.status}</strong>
                <span className="muted small">{a.payment?.amount} · {a.payment?.payee}</span>
              </button>
            ))}
          </aside>

          <div className="family-detail panel-inset">
            {!focus ? (
              <p className="muted">Select a request, or open a deep link from Confirm Pay.</p>
            ) : (
              <>
                <div className="chip-row">
                  <span className={`chip ${focus.status === "pending" ? "chip-bad" : focus.status === "approved" ? "" : "chip-bad"}`}>
                    {focus.status}
                  </span>
                  <span className="chip">{focus.payment?.risk}</span>
                  {focus.offlineSim && <span className="chip">offline sim</span>}
                </div>
                <h3 style={{ marginBottom: 0 }}>{focus.payment?.amount} → {focus.payment?.payee}</h3>
                <p className="muted small">{focus.payment?.entity}</p>
                <p>{focus.payment?.summary || focus.payerNote || "Payer asked you to review this payment."}</p>
                <p className="muted small">Guardian: {focus.contact?.name} ({focus.contact?.relation})</p>

                {focus.status === "pending" ? (
                  <>
                    <label className="small" style={{ display: "block", marginTop: "0.75rem" }}>
                      Note to payer (optional)
                      <textarea
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        style={{ width: "100%", marginTop: 4 }}
                        placeholder="e.g. Call me pehle — ye UPI suspicious lag raha hai"
                      />
                    </label>
                    <div className="row-actions" style={{ marginTop: "0.75rem" }}>
                      <button type="button" className="btn btn-safe" disabled={!!busy} onClick={() => decide("approved")}>
                        {busy === "approved" ? "Saving…" : "Approve"}
                      </button>
                      <button type="button" className="btn btn-danger" disabled={!!busy} onClick={() => decide("declined")}>
                        {busy === "declined" ? "Saving…" : "Decline — don't pay"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="alert-banner" style={{ marginTop: "0.75rem" }}>
                    <strong>Decision: {focus.status}</strong>
                    <div style={{ marginTop: 4 }}>{focus.decisionNote || "No note"}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <p className="muted small" style={{ marginBottom: 0 }}>
          Payer screen polls this status live. <Link to="/confirm-pay">Back to Confirm Pay</Link>
        </p>
      </section>
    </div>
  );
}
