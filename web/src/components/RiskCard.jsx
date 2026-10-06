import ReasonList from "./ReasonList.jsx";
import ActionButtons from "./ActionButtons.jsx";
import RiskGauge from "./RiskGauge.jsx";
import HighlightedMessage from "./HighlightedMessage.jsx";
import ExplainPanel from "./ExplainPanel.jsx";
import Findings from "./Findings.jsx";
import { riskClass, riskColor } from "../utils/riskStyles";

const SOURCE_BADGE = {
  grok: { label: "Live Grok", bg: "#002970" },
  mock: { label: "Rules", bg: "#64748b" },
  "qr-analyzer": { label: "QR analyzer", bg: "#0f766e" },
};

export default function RiskCard({ result, sourceText, extraFindings, extraFindingsTitle, onPrimary, onSecondary }) {
  if (!result) return null;

  const cls = riskClass(result.risk);
  const color = riskColor(result.risk);
  const badge = SOURCE_BADGE[result.source] || SOURCE_BADGE.mock;
  const hasMl = Boolean(result.ml);

  return (
    <section className={`risk-card ${cls}`} aria-live="polite">
      <div className="risk-head">
        <div className="risk-head-text">
          <div className="badge-row">
            <span className="badge" style={{ background: color }}>{result.risk}</span>
            <span className="badge" style={{ background: badge.bg }}>{badge.label}</span>
            {hasMl && <span className="badge" style={{ background: "#7c3aed" }}>+ ML model</span>}
          </div>
          <h2 style={{ margin: "0.55rem 0 0.35rem" }}>Shield result</h2>
          <p className="lead" style={{ margin: 0 }}>{result.hindi_summary}</p>
          {result.message ? (
            <p className="muted small" style={{ margin: "0.35rem 0 0" }}>{result.message}</p>
          ) : null}
        </div>
        <RiskGauge score={result.score} risk={result.risk} />
      </div>

      <p className="recommend">
        <strong>Recommended:</strong> {result.recommended_action}
      </p>

      {result.complaint_alert?.found ? (
        <div className="alert-banner">
          <strong>Community Complaint Alert</strong>
          <div style={{ marginTop: "0.35rem" }}>{result.complaint_alert.message_hi}</div>
          {result.complaint_alert.hits?.length > 1 ? (
            <div className="small" style={{ marginTop: "0.35rem" }}>
              Matches: {result.complaint_alert.hits.map((h) => `${h.entity} (${h.complaints})`).join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {result.qr && <Findings title="QR check" findings={result.qr.findings} fields={result.qr.fields} />}
      {extraFindings?.length > 0 && <Findings title={extraFindingsTitle} findings={extraFindings} />}

      {sourceText && !result.qr ? <HighlightedMessage text={sourceText} mlTokens={result.ml?.top_tokens} /> : null}

      {!result.qr && <ReasonList reasons={result.reasons} redFlags={result.red_flags} />}

      <ExplainPanel result={result} />

      <div style={{ marginTop: "1rem" }}>
        <ActionButtons result={result} onPrimary={onPrimary} onSecondary={onSecondary} />
      </div>
    </section>
  );
}
