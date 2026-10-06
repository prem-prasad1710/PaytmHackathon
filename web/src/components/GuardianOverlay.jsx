import { useEffect, useState } from "react";
import { HELPLINES } from "../data/threatSeed";

export default function GuardianOverlay({ result, onBlock, onReport, onClose }) {
  const [i, setI] = useState(0);
  const slides = (result?.reasons || []).slice(0, 4);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % slides.length), 3200);
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="guardian" role="alertdialog" aria-modal="true" aria-labelledby="guardian-title">
      <div className="guardian-card">
        <div className="guardian-icon" aria-hidden="true">!</div>
        <h2 id="guardian-title">
          {result.coercion?.coachingSuspected
            ? "Stop. Someone may be coaching you."
            : "Stop. This looks like a scam."}
        </h2>
        <p className="guardian-score">Risk score {result.score}/100</p>
        <p className="guardian-summary">
          {result.coercion?.coachingSuspected
            ? (result.coercion.interventionHi || result.coercion.interventionEn)
            : result.hindi_summary}
        </p>
        {result.coercion?.flags?.length > 0 && (
          <div className="chip-row" style={{ justifyContent: "center", marginBottom: "0.75rem" }}>
            {result.coercion.flags.map((f) => (
              <span key={f.id} className="chip signal-chip tone-danger">{f.label}</span>
            ))}
          </div>
        )}

        {slides.length > 0 && (
          <div className="guardian-slide" key={i} aria-live="polite">
            <span className="small">Why ({i + 1}/{slides.length})</span>
            <p>{slides[i]}</p>
          </div>
        )}
        <div className="guardian-dots" aria-hidden="true">
          {slides.map((_, n) => (
            <span key={n} className={n === i ? "on" : ""} />
          ))}
        </div>

        <div className="guardian-actions">
          <button type="button" className="btn btn-guardian" onClick={onBlock} autoFocus>
            Don't pay - block this
          </button>
          <button type="button" className="btn btn-ghost-light" onClick={onReport}>
            Report scam
          </button>
          <button type="button" className="btn btn-link-light" onClick={onClose}>
            Show details
          </button>
        </div>

        <p className="guardian-help">
          Already paid or shared a PIN/OTP? Call{" "}
          <a href={HELPLINES[0].href}><strong>1930</strong></a> immediately and inform your bank.
        </p>
      </div>
    </div>
  );
}
