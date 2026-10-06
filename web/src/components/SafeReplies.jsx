import { useState } from "react";
import { suggestSafeReplies } from "../../../shared/safeReplies.js";

export default function SafeReplies({ result, sourceText = "" }) {
  const pack = suggestSafeReplies(result, sourceText);
  const [copied, setCopied] = useState("");
  if (!pack.show) return null;

  async function copy(text, id) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("fail");
    }
  }

  return (
    <section className="safe-replies panel-inset" data-testid="safe-replies">
      <div className="section-head" style={{ marginBottom: "0.5rem" }}>
        <div>
          <span className="eyebrow">Counter-scam replies</span>
          <h3 style={{ margin: "0.15rem 0" }}>Safe things you can say</h3>
          <p className="muted small" style={{ margin: 0 }}>{pack.note}</p>
        </div>
      </div>

      <div className="reply-grid">
        {pack.replies.map((r) => (
          <article key={r.id} className="reply-card">
            <strong>{r.title}</strong>
            <p className="small">{r.textHi || r.text}</p>
            <p className="muted small">{r.text}</p>
            <button type="button" className="btn btn-secondary" onClick={() => copy(r.textHi || r.text, r.id)}>
              {copied === r.id ? "Copied" : "Copy reply"}
            </button>
          </article>
        ))}
      </div>

      <div className="helpline-card" data-testid="helpline-1930">
        <strong>Report to 1930</strong>
        <p style={{ margin: "0.35rem 0" }}>
          Already paid or shared OTP/PIN? Call <a href="tel:1930"><strong>1930</strong></a> now and file at{" "}
          <a href={pack.helpline.url} target="_blank" rel="noreferrer">{pack.helpline.url.replace("https://", "")}</a>.
        </p>
        <div className="row-actions">
          <a className="btn btn-danger" href="tel:1930">Call 1930</a>
          <a className="btn btn-secondary" href={pack.helpline.url} target="_blank" rel="noreferrer">
            Open cybercrime.gov.in
          </a>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              copy(
                `I am reporting a UPI/payment scam. Helpline 1930. Portal: ${pack.helpline.url}`,
                " helpline"
              )
            }
          >
            {copied === " helpline" ? "Copied" : "Copy report note"}
          </button>
        </div>
      </div>
    </section>
  );
}
