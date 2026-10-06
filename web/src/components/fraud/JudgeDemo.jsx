import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { JUDGE_DEMO_META, getJudgeDemoSteps } from "../../../../shared/judgeScript.js";
import { detectPlaybook } from "../../../../shared/playbook.js";
import { detectCoercion } from "../../../../shared/coercion.js";
import { pickMockByText, finalizeAnalysis } from "../../services/offlineEngine.js";
import { buildMessageDualExplain, buildPaymentDualExplain } from "../../../../shared/dualExplain.js";
import DecisionCard from "./DecisionCard.jsx";
import PlaybookTimeline from "./PlaybookTimeline.jsx";
import StatusBadge from "../StatusBadge.jsx";

const STEPS = getJudgeDemoSteps();

function SignalChips({ coercion, analysis }) {
  const items = [
    ...(coercion?.flags || []).map((f) => ({ key: f.id, label: f.label, tone: "danger" })),
    ...(analysis?.red_flags || []).slice(0, 4).map((f) => ({ key: f, label: f, tone: "warn" })),
  ];
  if (!items.length) return null;
  return (
    <div className="chip-row judge-chips" aria-label="Detected signals">
      {items.map((i) => (
        <span key={i.key} className={`chip signal-chip tone-${i.tone}`}>{i.label}</span>
      ))}
    </div>
  );
}

export default function JudgeDemo({ onClose, embedded = false }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const step = STEPS[stepIdx];
  const atEnd = stepIdx >= STEPS.length - 1;
  const atStart = stepIdx === 0;

  const analysis = useMemo(() => {
    if (!step?.message) return null;
    return finalizeAnalysis(pickMockByText(step.message), step.message, {
      source: "mock",
      message: "Judge demo · offline Shield engine",
    });
  }, [step]);

  const coercion = useMemo(() => (step?.message ? detectCoercion(step.message) : null), [step]);
  const playbook = useMemo(() => {
    if (step?.kind === "playbook" || step?.kind === "signals" || step?.kind === "guardian" || step?.kind === "outcome") {
      return detectPlaybook(step.message || "", {
        collect: true,
        coercionRemote: coercion?.flags?.some((f) => f.id === "screen_share"),
        coercionAuthority: coercion?.flags?.some((f) => f.id === "authority_fear"),
      });
    }
    return step?.message ? detectPlaybook(step.message, { collect: true }) : null;
  }, [step, coercion]);

  const dualMsg = useMemo(() => (analysis ? buildMessageDualExplain({ ...analysis, coercion, playbook }) : null), [analysis, coercion, playbook]);
  const dualPay = useMemo(
    () => (step?.decision ? buildPaymentDualExplain({ ...step.decision, playbook }) : null),
    [step, playbook]
  );

  const reset = useCallback(() => {
    setPlaying(false);
    setStepIdx(0);
  }, []);

  const next = useCallback(() => {
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  }, []);

  const prev = useCallback(() => {
    setPlaying(false);
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!playing || atEnd) {
      if (atEnd) setPlaying(false);
      return undefined;
    }
    const t = setTimeout(() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1)), 5200);
    return () => clearTimeout(t);
  }, [playing, stepIdx, atEnd]);

  return (
    <section className={`panel judge-demo ${embedded ? "judge-embedded" : ""}`} data-testid="judge-demo">
      <header className="judge-head">
        <div>
          <span className="eyebrow">Live judge demo · offline</span>
          <h2 style={{ margin: "0.2rem 0" }}>{JUDGE_DEMO_META.title}</h2>
          <p className="muted" style={{ margin: 0 }}>{JUDGE_DEMO_META.blurb}</p>
        </div>
        <div className="judge-head-actions">
          <StatusBadge mode="offline" detail="Runs without Grok / API" />
          {onClose && (
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          )}
        </div>
      </header>

      <ol className="judge-stepper" aria-label="Demo steps">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`judge-step-dot ${i === stepIdx ? "active" : ""} ${i < stepIdx ? "done" : ""}`}
              onClick={() => { setPlaying(false); setStepIdx(i); }}
              aria-current={i === stepIdx ? "step" : undefined}
            >
              <span className="num">{i + 1}</span>
              <span className="lab">{s.title.replace(/^\d+\s·\s/, "")}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="judge-stage" data-testid="judge-stage">
        <div className="judge-narration">
          <h3 style={{ marginTop: 0 }}>{step.title}</h3>
          <p>{step.narration}</p>
          <p className="muted small">{step.narrationHi}</p>
        </div>

        <div className="judge-body">
          {(step.kind === "message" || step.kind === "signals" || step.kind === "guardian") && (
            <div className="judge-message panel-inset">
              <strong className="small">Incoming message</strong>
              <blockquote>{step.message}</blockquote>
              {step.kind !== "message" && <SignalChips coercion={coercion} analysis={analysis} />}
              {dualMsg && step.kind === "signals" && (
                <div className="dual-mini">
                  <strong className="small">User view</strong>
                  <p style={{ margin: "0.25rem 0 0" }}>{dualMsg.user.headline}</p>
                </div>
              )}
            </div>
          )}

          {(step.kind === "playbook" || step.kind === "outcome") && playbook && (
            <PlaybookTimeline playbook={playbook} compact={step.kind === "outcome"} />
          )}

          {(step.kind === "decision" || step.kind === "outcome") && step.decision && (
            <div className="stack">
              {dualPay && (
                <div className="dual-explain dual-compact">
                  <div className="dual-user">
                    <span className="eyebrow">For the user</span>
                    <p>{dualPay.user.headline}</p>
                  </div>
                  <div className="dual-analyst">
                    <span className="eyebrow">Analyst view</span>
                    <p className="muted small" style={{ margin: 0 }}>
                      {step.decision.decision} · score {step.decision.riskScore} · rules{" "}
                      {(step.decision.rules?.triggeredRules || []).join(", ")}
                    </p>
                  </div>
                </div>
              )}
              {step.kind === "decision" && (
                <DecisionCard result={{ ...step.decision, playbook, dual: dualPay }} onInvestigate={() => {}} onDna={() => {}} />
              )}
            </div>
          )}

          {step.kind === "guardian" && analysis && (
            <div className="judge-guardian-card" role="status">
              <div className="guardian-icon" aria-hidden="true">!</div>
              <h3 style={{ margin: "0.4rem 0" }}>Stop. Someone may be coaching you.</h3>
              <p>{coercion?.interventionHi || analysis.hindi_summary}</p>
              <p className="muted small">Risk {analysis.score}/100 · hang up · quit AnyDesk · call 1930</p>
              <div className="row-actions">
                <span className="btn btn-guardian" style={{ pointerEvents: "none" }}>Don't pay — block this</span>
                <Link className="btn btn-secondary" to="/blocked">Open block screen</Link>
              </div>
            </div>
          )}

          {step.kind === "outcome" && (
            <div className="alert-banner" style={{ marginTop: "0.75rem" }}>
              <strong>Demo outcome: BLOCKED</strong>
              <div style={{ marginTop: "0.35rem" }}>
                Money never left the account. Playbook logged for the judge panel. Advisory only — no real UPI.
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="judge-controls">
        <button type="button" className="btn btn-secondary" onClick={prev} disabled={atStart}>← Back</button>
        <button
          type="button"
          className={`btn ${playing ? "btn-secondary" : "btn-primary"}`}
          onClick={() => setPlaying((p) => !p)}
          disabled={atEnd && !playing}
        >
          {playing ? "Pause" : atEnd ? "Playing done" : "Play"}
        </button>
        <button type="button" className="btn btn-primary" onClick={next} disabled={atEnd} data-testid="judge-next">
          Next →
        </button>
        <button type="button" className="btn btn-secondary" onClick={reset} data-testid="judge-reset">Reset</button>
        <span className="muted small" style={{ marginLeft: "auto" }}>
          Step {stepIdx + 1} / {STEPS.length}
        </span>
      </footer>
    </section>
  );
}
