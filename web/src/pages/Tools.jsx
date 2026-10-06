import { Link } from "react-router-dom";

const TOOLS = [
  { to: "/analyze", icon: "▣", title: "Check a QR, message or screenshot", text: "Rules, a trained text model and community reports in one verdict." },
  { to: "/links", icon: "🔗", title: "Link Shield", text: "Spot look-alike domains, short links and phishing pages before you tap." },
  { to: "/call", icon: "📞", title: "Call Shield", text: "Live risk meter for a suspicious call. Speak or paste the conversation." },
  { to: "/academy", icon: "🎓", title: "Scam Academy", text: "Spot-the-scam practice with streaks and badges, built from real tactics." },
  { to: "/report-pack", icon: "📝", title: "Cybercrime report pack", text: "Turn your checks into a ready-to-file complaint for 1930 / cybercrime.gov.in." },
  { to: "/family", icon: "👨‍👩‍👧", title: "Family Guard", text: "Ask a trusted contact to approve a risky payment." },
  { to: "/lab", icon: "⚡", title: "Fraud Lab", text: "XGBoost + network graph + rules scoring every payment, live." },
  { to: "/console", icon: "🛡", title: "Analyst Console", text: "Review flagged payments, give feedback and watch the model's precision." },
  { to: "/threats", icon: "🗺", title: "Community threat map", text: "Where scams are being reported across India." },
  { to: "/model", icon: "🧠", title: "Model card", text: "Real metrics, how it works and where it can be wrong." },
];

export default function Tools() {
  return (
    <div className="stack">
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>All Shield tools</h2>
        <p className="muted" style={{ marginBottom: 0 }}>Everything in one place. Pick the check that matches how the scammer reached you.</p>
      </section>
      <section className="tools-grid">
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} className="feature feature-link tool-tile">
            <span className="tool-icon" aria-hidden="true">{t.icon}</span>
            <strong>{t.title}</strong>
            <span>{t.text}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
