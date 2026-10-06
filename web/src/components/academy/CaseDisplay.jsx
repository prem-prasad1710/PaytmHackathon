import { useMemo } from "react";

const CHANNEL_META = {
  sms: { label: "SMS", icon: "💬", className: "academy-case--sms" },
  whatsapp: { label: "WhatsApp", icon: "📱", className: "academy-case--whatsapp" },
  call: { label: "Phone call", icon: "📞", className: "academy-case--call" },
  qr: { label: "QR code", icon: "▣", className: "academy-case--qr" },
  email: { label: "Email", icon: "✉", className: "academy-case--email" },
  "upi-request": { label: "UPI request", icon: "₹", className: "academy-case--upi" },
};

function highlightBody(body, redFlags) {
  if (!redFlags?.length) return [{ text: body, flag: null }];

  const lower = body.toLowerCase();
  const matches = [];
  for (const flag of redFlags) {
    const idx = lower.indexOf(flag.snippet.toLowerCase());
    if (idx >= 0) {
      matches.push({ start: idx, end: idx + flag.snippet.length, flag });
    }
  }
  if (!matches.length) return [{ text: body, flag: null }];

  matches.sort((a, b) => a.start - b.start);
  const parts = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    if (m.start > cursor) parts.push({ text: body.slice(cursor, m.start), flag: null });
    parts.push({ text: body.slice(m.start, m.end), flag: m.flag });
    cursor = m.end;
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor), flag: null });
  return parts;
}

export default function CaseDisplay({ caseItem, showFlags }) {
  const meta = CHANNEL_META[caseItem.channel] || CHANNEL_META.sms;
  const parts = useMemo(
    () => (showFlags ? highlightBody(caseItem.body, caseItem.redFlags) : [{ text: caseItem.body, flag: null }]),
    [caseItem, showFlags]
  );

  return (
    <div className={`academy-case ${meta.className}`} role="article" aria-label={`${meta.label} from ${caseItem.sender}`}>
      <div className="academy-case__header">
        <span className="academy-case__channel" aria-hidden="true">{meta.icon}</span>
        <div>
          <span className="academy-case__channel-label">{meta.label}</span>
          <strong className="academy-case__sender">{caseItem.sender}</strong>
        </div>
      </div>

      <div className="academy-case__body">
        {caseItem.channel === "call" && (
          <div className="academy-case__call-ring" aria-hidden="true">
            <span className="academy-case__call-pulse" />
            Incoming call…
          </div>
        )}
        {caseItem.channel === "qr" && (
          <div className="academy-case__qr-placeholder" aria-hidden="true">
            <span>▣▣▣</span>
            <span className="small muted">QR payload</span>
          </div>
        )}
        <p className="academy-case__text">
          {parts.map((p, i) =>
            p.flag ? (
              <mark
                key={i}
                className="academy-flag"
                title={p.flag.why}
                tabIndex={0}
              >
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )}
        </p>
      </div>

      {showFlags && caseItem.redFlags?.length > 0 && (
        <ul className="academy-flag-list">
          {caseItem.redFlags.map((f, i) => (
            <li key={i}>
              <strong>"{f.snippet}"</strong>
              <span className="muted"> — {f.why}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
