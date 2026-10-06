const ICON = { high: "!", medium: "!", low: "i", info: "i", ok: "✓" };

const FIELD_LABEL = {
  action: "Type",
  pa: "UPI ID",
  pn: "Payee name",
  am: "Amount (₹)",
  tn: "Note",
  handle: "Bank / app handle",
  cu: "Currency",
  mc: "Merchant code",
  host: "Website",
  domain: "Domain",
  url: "Link",
  payload: "Content",
};

export default function Findings({ title = "What we found", findings = [], fields }) {
  if (!findings.length && !fields) return null;
  return (
    <div className="findings">
      <strong>{title}</strong>
      {fields && (
        <dl className="fields">
          {Object.entries(fields)
            .filter(([, v]) => v !== "" && v !== null && v !== undefined)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{FIELD_LABEL[k] || k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
        </dl>
      )}
      <ul>
        {findings.map((f) => (
          <li key={f.id} className={`finding finding-${f.severity}`}>
            <span className="finding-icon">{ICON[f.severity]}</span>
            <div>
              <div className="finding-title">{f.title}</div>
              {f.detail && <div className="muted small">{f.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
