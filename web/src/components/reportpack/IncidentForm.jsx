import { CHANNEL_LABELS, PAYMENT_MODE_LABELS } from "../../utils/reportPack.js";
import EvidenceChecklist from "./EvidenceChecklist.jsx";

const STEPS = [
  { id: "when", title: "When" },
  { id: "who", title: "Scammer details" },
  { id: "money", title: "Payment" },
  { id: "story", title: "Description" },
];

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function IncidentForm({ data, onChange, step, onStepChange, errors }) {
  const set = (field, value) => onChange({ ...data, [field]: value });

  return (
    <div className="form-section">
      <nav className="stepper-nav no-print" aria-label="Form steps">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`${step === i ? "active" : ""} ${i < step ? "done" : ""}`}
            onClick={() => onStepChange(i)}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </nav>

      {step === 0 && (
        <div>
          <h3>When did it happen?</h3>
          <label>
            <span>Incident date &amp; time</span>
            <input
              type="datetime-local"
              value={toLocalInput(data.incidentAt)}
              onChange={(e) => set("incidentAt", fromLocalInput(e.target.value))}
              required
            />
            {errors.incidentAt && <span className="field-error">{errors.incidentAt}</span>}
          </label>
          <label>
            <span>When you discovered it (optional)</span>
            <input
              type="datetime-local"
              value={toLocalInput(data.discoveredAt)}
              onChange={(e) => set("discoveredAt", fromLocalInput(e.target.value))}
            />
          </label>
          <label>
            <span>How did the scammer contact you?</span>
            <select value={data.channel} onChange={(e) => set("channel", e.target.value)} required>
              <option value="">Select…</option>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {errors.channel && <span className="field-error">{errors.channel}</span>}
          </label>
        </div>
      )}

      {step === 1 && (
        <div>
          <h3>Scammer details</h3>
          <p className="muted small">Add at least one — phone, UPI ID, or link.</p>
          <label>
            <span>Phone number</span>
            <input
              type="tel"
              inputMode="numeric"
              value={data.scammerPhone}
              onChange={(e) => set("scammerPhone", e.target.value)}
              placeholder="10-digit mobile"
              maxLength={15}
            />
          </label>
          <label>
            <span>UPI ID</span>
            <input
              type="text"
              value={data.scammerUpi}
              onChange={(e) => set("scammerUpi", e.target.value)}
              placeholder="name@bank"
              maxLength={80}
            />
          </label>
          <label>
            <span>Link / website</span>
            <input
              type="url"
              value={data.scammerUrl}
              onChange={(e) => set("scammerUrl", e.target.value)}
              placeholder="https://…"
              maxLength={200}
            />
          </label>
          {errors.scammerId && <span className="field-error">{errors.scammerId}</span>}
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>Payment details</h3>
          <label>
            <span>Amount lost (₹) — 0 if no payment</span>
            <input
              type="number"
              min="0"
              step="1"
              value={data.amountLost || ""}
              onChange={(e) => set("amountLost", Number(e.target.value) || 0)}
            />
          </label>
          {(data.amountLost || 0) > 0 && (
            <>
              <label>
                <span>Payment mode</span>
                <select value={data.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>
                  <option value="">Select…</option>
                  {Object.entries(PAYMENT_MODE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                {errors.paymentMode && <span className="field-error">{errors.paymentMode}</span>}
              </label>
              <label>
                <span>Transaction ID / UTR</span>
                <input
                  type="text"
                  value={data.txnRef}
                  onChange={(e) => set("txnRef", e.target.value)}
                  maxLength={60}
                />
                {errors.txnRef && <span className="field-error">{errors.txnRef}</span>}
              </label>
              <label>
                <span>Bank / UPI app</span>
                <input
                  type="text"
                  value={data.bank}
                  onChange={(e) => set("bank", e.target.value)}
                  placeholder="e.g. Paytm, SBI, PhonePe"
                  maxLength={80}
                />
              </label>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <h3>What happened?</h3>
          <label>
            <span>Description (for complaint draft)</span>
            <textarea
              value={data.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={800}
              rows={5}
              placeholder="What did they say? What did you share or pay?"
            />
          </label>
          <h3 style={{ marginTop: "1rem" }}>Evidence you have saved</h3>
          <EvidenceChecklist
            evidence={data.evidence || {}}
            onChange={(key, val) => onChange({ ...data, evidence: { ...data.evidence, [key]: val } })}
          />
        </div>
      )}

      <div className="row-actions no-print" style={{ marginTop: "0.75rem" }}>
        {step > 0 && (
          <button type="button" className="btn btn-secondary" onClick={() => onStepChange(step - 1)}>
            Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button type="button" className="btn btn-primary" onClick={() => onStepChange(step + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
