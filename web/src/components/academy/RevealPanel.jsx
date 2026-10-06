import { useState } from "react";
import { analyzeText } from "../../services/analyzeApi.js";
import CaseDisplay from "./CaseDisplay.jsx";

export default function RevealPanel({ caseItem, result, onNext, isLast }) {
  const [modelResult, setModelResult] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");

  const humanLabel = result.userSaysScam ? "Scam" : "Looks genuine";
  const truthLabel = caseItem.isScam ? "Scam" : "Genuine";

  async function askShield() {
    setModelLoading(true);
    setModelError("");
    try {
      const data = await analyzeText(caseItem.body);
      setModelResult(data);
    } catch (err) {
      setModelError(err.message || "Model unavailable");
    } finally {
      setModelLoading(false);
    }
  }

  const modelSaysScam = modelResult
    ? modelResult.risk === "High Risk" || (modelResult.risk === "Caution" && modelResult.score >= 55)
    : null;
  const modelDisagrees =
    modelResult &&
    ((caseItem.isScam && !modelSaysScam) || (!caseItem.isScam && modelSaysScam));

  return (
    <div
      className={`academy-reveal ${result.correct ? "academy-reveal--correct" : "academy-reveal--wrong"}`}
      role="status"
      aria-live="polite"
    >
      <div className="academy-reveal__verdict">
        {result.correct ? (
          <span className="academy-reveal__icon" aria-hidden="true">✓</span>
        ) : (
          <span className="academy-reveal__icon" aria-hidden="true">✗</span>
        )}
        <div>
          <strong>{result.correct ? "Correct!" : "Not quite"}</strong>
          <p className="muted small" style={{ margin: 0 }}>
            You said {humanLabel}. Answer: {truthLabel}.
            {result.fast && " ⚡ Fast Thinker bonus!"}
            {result.bonus > 0 && ` +${result.bonus} streak XP`}
          </p>
        </div>
      </div>

      <CaseDisplay caseItem={caseItem} showFlags />

      <div className="academy-reveal__explain">
        <p><strong>Why:</strong> {caseItem.explanation}</p>
        <p><strong>What to do:</strong> {caseItem.whatToDo}</p>
      </div>

      <div className="academy-reveal__model">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={askShield}
          disabled={modelLoading}
        >
          {modelLoading ? "Asking Shield…" : "Ask the Shield model"}
        </button>
        {modelError && <p className="error-banner">{modelError}</p>}
        {modelResult && (
          <div className="academy-model-verdict">
            <span className={`badge badge-${modelResult.risk === "High Risk" ? "danger" : modelResult.risk === "Caution" ? "warn" : "safe"}`}>
              Model: {modelResult.risk} ({modelResult.score}/100)
            </span>
            <span className="muted small">
              Your answer: {humanLabel} · Ground truth: {truthLabel}
            </span>
            {modelDisagrees && (
              <p className="academy-model-note">
                Note: The model disagrees with the training label here. Models can miss subtle scams or flag legitimate bank alerts — use your judgment and verify through official channels.
              </p>
            )}
          </div>
        )}
      </div>

      <button type="button" className="btn btn-primary academy-reveal__next" onClick={onNext}>
        {isLast ? "See results" : "Next case"}
      </button>
    </div>
  );
}
