import { Link } from "react-router-dom";

const STEPS = [
  "Cut the call immediately — hang up.",
  "No agency arrests people on video calls. This is a scam.",
  "Never share OTP, PIN, or card details on a call.",
  "Do not install remote-access apps (AnyDesk, TeamViewer).",
  "Do not transfer money to any 'safe account'.",
];

export default function HangUpPanel({ summary, risk, score, onSave, saved }) {
  return (
    <div className="call-hangup-panel" role="alert" aria-live="assertive">
      <h3>HANG UP NOW</h3>
      <p className="call-hangup-lead">This call shows strong signs of a scam. Protect yourself:</p>
      <ol className="call-hangup-steps">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="call-hangup-actions">
        <a href="tel:1930" className="btn btn-danger call-helpline-btn">
          Call 1930 — Cyber Helpline
        </a>
        <Link
          to="/report-pack"
          state={{ source: "call", summary, payee: "", risk, score }}
          className="btn btn-secondary"
        >
          Prepare report pack
        </Link>
        <button type="button" className="btn btn-secondary" onClick={onSave} disabled={saved}>
          {saved ? "Saved to history" : "Save to history"}
        </button>
      </div>
    </div>
  );
}
