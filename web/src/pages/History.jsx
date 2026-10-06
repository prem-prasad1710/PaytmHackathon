import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  SAMPLE_TRANSACTIONS,
  COMPLAINT_RECIPIENTS,
  buildComplaintPayload,
  buildMailto,
} from "../data/transactions.js";
import { clearChecks, getChecks, useStoreValue } from "../utils/store";
import { riskColor } from "../utils/riskStyles";

const KIND = { qr: "QR", message: "Message", screenshot: "Screenshot" };
const FILTERS = ["All", "High Risk", "Caution", "Safe"];

function MyChecks() {
  const checks = useStoreValue(getChecks);
  const [filter, setFilter] = useState("All");
  const shown = checks.filter((c) => filter === "All" || c.risk === filter);

  return (
    <section className="panel stack">
      <div className="section-head">
        <div>
          <h2 style={{ margin: 0 }}>My checks</h2>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>Saved only on this device.</p>
        </div>
        <div className="row-actions" style={{ margin: 0 }}>
          <Link className="btn btn-primary" to="/report-pack" state={{ source: "check" }}>
            Report pack
          </Link>
          {checks.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={clearChecks}>Clear all</button>
          )}
        </div>
      </div>

      <div className="sample-row" role="group" aria-label="Filter by risk">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${filter === f ? "chip-on" : ""}`}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {checks.length ? "No checks match this filter." : "No checks yet. Scan a QR or paste a message to begin."}
        </p>
      ) : (
        <ul className="recent">
          {shown.map((c) => (
            <li key={c.id}>
              <span className="dot-risk" style={{ background: riskColor(c.risk) }} aria-hidden="true" />
              <div className="grow">
                <div className="recent-top">
                  <strong>{c.risk}</strong>
                  <span className="muted small">
                    {KIND[c.kind] || "Check"} · {new Date(c.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <div className="small ellipsis">{c.input}</div>
                <div className="muted small">{c.summary}</div>
              </div>
              <span className="recent-score">{c.score}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Transactions() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(SAMPLE_TRANSACTIONS[0]?.id || "");
  const selected = useMemo(
    () => SAMPLE_TRANSACTIONS.find((t) => t.id === selectedId) || null,
    [selectedId]
  );

  function raiseComplaint(recipient) {
    if (!selected) return;
    const payload = buildComplaintPayload(selected, recipient);
    try {
      window.open(buildMailto(payload), "_blank");
    } catch {
      /* ignore */
    }
    navigate("/complaint-sent", { state: { payload } });
  }

  return (
    <>
      <section className="panel stack">
        <div>
          <h2 style={{ marginTop: 0 }}>Transaction History</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Transaction select karo, phir <strong>Raise Complaint</strong> pe click —
            details auto-fill hokar Paytm / NPCI ko complaint chali jayegi (demo).
          </p>
        </div>

        <div className="txn-list">
          {SAMPLE_TRANSACTIONS.map((txn) => {
            const active = txn.id === selectedId;
            return (
              <button
                key={txn.id}
                type="button"
                className={`txn-item ${active ? "active" : ""}`}
                onClick={() => setSelectedId(txn.id)}
              >
                <div className="txn-top">
                  <strong>{txn.payeeName}</strong>
                  <span className="txn-amount debit">{txn.amount}</span>
                </div>
                <div className="txn-meta">
                  <span>{txn.date} · {txn.time}</span>
                  <span>{txn.category}</span>
                </div>
                <div className="txn-meta">
                  <span>{txn.id}</span>
                  <span>{txn.upiId || txn.mobile || txn.note}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="panel stack">
          <h3 style={{ margin: 0 }}>Complaint for selected transaction</h3>
          <div className="feature">
            <strong>{selected.payeeName}</strong>
            <div>{selected.amount} · {selected.id}</div>
            <div className="muted">{selected.upiId || selected.mobile || "—"} · {selected.note}</div>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Select karne ke baad sirf Complaint pe click karo. Transaction details auto-fill ho jayenge.
          </p>
          <div className="row-actions">
            {COMPLAINT_RECIPIENTS.map((r) => (
              <button key={r.id} type="button" className="btn btn-danger" onClick={() => raiseComplaint(r)}>
                Raise Complaint → {r.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function History() {
  const [tab, setTab] = useState("checks");
  return (
    <div className="stack">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "checks"} className={`tab ${tab === "checks" ? "active" : ""}`} onClick={() => setTab("checks")}>
          My checks
        </button>
        <button role="tab" aria-selected={tab === "txns"} className={`tab ${tab === "txns" ? "active" : ""}`} onClick={() => setTab("txns")}>
          Transactions &amp; complaints
        </button>
      </div>
      {tab === "checks" ? <MyChecks /> : <Transactions />}
    </div>
  );
}
