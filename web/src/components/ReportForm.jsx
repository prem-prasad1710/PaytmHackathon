import { useState } from "react";
import { Link } from "react-router-dom";
import { REPORT_CATEGORIES, STATE_TILES } from "../data/threatSeed";
import { submitReport } from "../services/communityApi";
import { getSettings, setSettings } from "../utils/store";

const TYPES = [
  { id: "upi", label: "UPI ID" },
  { id: "mobile", label: "Mobile number" },
  { id: "link", label: "Link / website" },
  { id: "qr", label: "QR code" },
  { id: "message", label: "Message" },
];

export default function ReportForm({ initial = {}, onDone }) {
  const [entity, setEntity] = useState(initial.entity || "");
  const [type, setType] = useState(initial.type || "upi");
  const [category, setCategory] = useState(initial.category || REPORT_CATEGORIES[0]);
  const [state, setState] = useState(getSettings().homeState || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!entity.trim()) return;
    setBusy(true);
    if (state) setSettings({ homeState: state });
    const out = await submitReport({ entity: entity.trim(), type, category, state, note });
    setBusy(false);
    setDone(out);
    onDone?.(out);
  }

  if (done) {
    return (
      <div className="report-done">
        <div className="mock-success" aria-hidden="true">✓</div>
        <h3>Thanks - report received</h3>
        <p className="muted">
          {done.synced
            ? "It is now on the community map and will warn other users who meet this sender."
            : "Saved on this device. It will count on the map once the server is reachable."}
        </p>
        <div className="row-actions" style={{ justifyContent: "center" }}>
          <Link className="btn btn-primary" to="/threats">View threat map</Link>
          <Link className="btn btn-secondary" to="/analyze">Check another</Link>
        </div>
        <p className="muted small">
          Lost money? Call <a href="tel:1930"><strong>1930</strong></a> or file at{" "}
          <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="stack report-form" onSubmit={submit}>
      <div className="field-row">
        <label>
          <span>What are you reporting?</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="grow">
          <span>UPI ID / number / link</span>
          <input
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            placeholder="e.g. refund.claim@ybl or 98xxxxxx10"
            required
            maxLength={120}
          />
        </label>
      </div>
      <div className="field-row">
        <label className="grow">
          <span>Scam type</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {REPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>
          <span>Your state</span>
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Not shared</option>
            {STATE_TILES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <label>
        <span>What happened? (optional, no personal details)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} />
      </label>
      <div className="row-actions" style={{ marginTop: 0 }}>
        <button className="btn btn-danger" disabled={busy || !entity.trim()}>
          {busy ? "Sending..." : "Submit report"}
        </button>
      </div>
    </form>
  );
}
