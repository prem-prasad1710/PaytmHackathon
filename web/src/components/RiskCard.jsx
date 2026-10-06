import ReasonList from "./ReasonList.jsx";
import ActionButtons from "./ActionButtons.jsx";
import RiskGauge from "./RiskGauge.jsx";
import HighlightedMessage from "./HighlightedMessage.jsx";
import ExplainPanel from "./ExplainPanel.jsx";
import Findings from "./Findings.jsx";
import PlaybookTimeline from "./fraud/PlaybookTimeline.jsx";
import StatusBadge, { inferStatusMode } from "./StatusBadge.jsx";
import DualExplain from "./DualExplain.jsx";
import SafeReplies from "./SafeReplies.jsx";
import { riskClass, riskColor } from "../utils/riskStyles";

export default function RiskCard({ result, sourceText, extraFindings, extraFindingsTitle, onPrimary, onSecondary }) {
  if (!result) return null;

  const cls = riskClass(result.risk);
  const color = riskColor(result.risk);
  const hasMl = Boolean(result.ml);
  const statusMode = inferStatusMode(result);

  return (
    <section className={`risk-card ${cls}`} aria-live="polite">
      <div className="risk-head">
        <div className="risk-head-text">
          <div className="badge-row">
            <span className="badge" style={{ background: color }}>{result.risk}</span>
            <StatusBadge mode={statusMode} detail={result.message} />
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

      {result.coercion?.coachingSuspected && (
        <div className="coercion-banner" role="status" data-testid="coercion-banner">
          <strong>Someone may be coaching you</strong>
          <div style={{ marginTop: "0.35rem" }}>{result.coercion.interventionHi || result.coercion.interventionEn}</div>
        </div>
      )}

      {result.playbook && <PlaybookTimeline playbook={result.playbook} />}

      {result.dual && <DualExplain dual={result.dual} />}

      <SafeReplies result={result} sourceText={sourceText} />

      <ExplainPanel result={result} />

      <div style={{ marginTop: "1rem" }}>
        <ActionButtons result={result} onPrimary={onPrimary} onSecondary={onSecondary} />
      </div>
    </section>
  );
}
