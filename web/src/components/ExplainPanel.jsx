import { Link } from "react-router-dom";

function Bar({ label, value, color, hint }) {
  return (
    <div className="bar-row">
      <div className="bar-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="bar-track" title={hint}>
        <div className="bar-fill" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }} />
      </div>
    </div>
  );
}

export default function ExplainPanel({ result }) {
  const bd = result?.score_breakdown;
  const ml = result?.ml;
  if (!bd && !ml && result?.source !== "qr-analyzer") return null;

  const ruleLabel = result.source === "grok" ? "Grok verdict" : "Rule engine";

  return (
    <details className="explain" open>
      <summary>
        <strong>How Shield scored this</strong>
        <span className="muted"> · explainable AI</span>
      </summary>

      {bd && bd.ml !== null && (
        <div className="explain-grid">
          <div>
            <Bar label={ruleLabel} value={bd.rules} color="#00baf2" />
            <Bar label="ML model" value={bd.ml} color="#7c3aed" hint="Probability that the text is a scam" />
            <Bar label="Final score" value={bd.final} color="var(--navy)" />
            <p className="muted small">
              {bd.mode === "ml_led"
                ? "No known scam template matched, so the ML model leads the decision."
                : "Rules and ML are blended; the more alarmed signal gets extra weight (safety-first)."}
              {bd.upgraded ? " ML raised the risk level." : ""}
              {bd.downgraded ? " ML lowered the risk level." : ""}
            </p>
          </div>

          {ml && (
            <div>
              {ml.category && (
                <p style={{ margin: "0 0 0.5rem" }}>
                  <span className="pill pill-purple">{ml.category.label}</span>
                  <span className="muted small"> {Math.round((ml.category_confidence || 0) * 100)}% confident</span>
                </p>
              )}
              {ml.top_tokens?.length > 0 && (
                <>
                  <strong className="small">Words pushing toward scam</strong>
                  <div className="token-list">
                    {ml.top_tokens.slice(0, 8).map((t) => (
                      <span key={t.token} className="token token-bad">
                        {t.token}
                        <em>+{t.weight.toFixed(2)}</em>
                      </span>
                    ))}
                  </div>
                </>
              )}
              {ml.safe_tokens?.length > 0 && (
                <>
                  <strong className="small" style={{ display: "block", marginTop: "0.6rem" }}>
                    Words pushing toward safe
                  </strong>
                  <div className="token-list">
                    {ml.safe_tokens.slice(0, 5).map((t) => (
                      <span key={t.token} className="token token-good">
                        {t.token}
                        <em>{t.weight.toFixed(2)}</em>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {bd && bd.ml === null && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          ML service is offline — decision came from {ruleLabel.toLowerCase()} only. Start it with{" "}
          <code>npm run dev:ml</code> for model-based explanations.
        </p>
      )}

      {result.source === "qr-analyzer" && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          QR payloads are analysed on your device with transparent rules - every finding above maps to a fixed check.
        </p>
      )}

      {ml && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          Model: {ml.model} · <Link to="/model">see model card &amp; accuracy</Link>
        </p>
      )}
    </details>
  );
}
