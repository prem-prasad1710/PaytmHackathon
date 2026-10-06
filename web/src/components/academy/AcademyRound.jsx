import { useCallback, useEffect, useRef, useState } from "react";
import { FAST_THRESHOLD_MS, inRoundStreakBonus } from "../../utils/academyEngine.js";
import CaseDisplay from "./CaseDisplay.jsx";
import RevealPanel from "./RevealPanel.jsx";

export default function AcademyRound({
  cases,
  title,
  onComplete,
  onExit,
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("question");
  const [answers, setAnswers] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const answersRef = useRef([]);
  const startRef = useRef(Date.now());
  const questionRef = useRef(null);

  const current = cases[index];
  const progress = cases.length;

  useEffect(() => {
    startRef.current = Date.now();
    questionRef.current?.focus();
  }, [index]);

  const submit = useCallback(
    (userSaysScam) => {
      if (phase !== "question" || !current) return;
      const timeMs = Date.now() - startRef.current;
      let prevStreak = 0;
      for (const a of answers) {
        if (a.userSaysScam === a.caseItem.isScam) prevStreak += 1;
        else prevStreak = 0;
      }
      const correct = userSaysScam === current.isScam;
      const streak = correct ? prevStreak + 1 : 0;
      const record = { caseItem: current, userSaysScam, timeMs };
      const nextAnswers = [...answersRef.current, record];
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      setLastResult({
        userSaysScam,
        timeMs,
        correct,
        fast: correct && timeMs < FAST_THRESHOLD_MS,
        bonus: correct ? inRoundStreakBonus(streak) : 0,
      });
      setPhase("reveal");
    },
    [phase, current, answers]
  );

  useEffect(() => {
    function onKey(e) {
      if (phase !== "question") return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        submit(true);
      }
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        submit(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, submit]);

  function handleNext() {
    if (index + 1 >= cases.length) {
      onComplete(answersRef.current);
      return;
    }
    setIndex((i) => i + 1);
    setPhase("question");
    setLastResult(null);
  }

  if (!current) return null;

  return (
    <div className="academy-round stack">
      <div className="academy-round__top">
        <button type="button" className="btn btn-secondary academy-round__exit" onClick={onExit}>
          ← Exit
        </button>
        <h2 className="academy-round__title">{title}</h2>
        <div className="academy-round__timer muted small" aria-live="off">
          ⏱ Fast Thinker: &lt;6s
        </div>
      </div>

      <div className="academy-progress" role="progressbar" aria-valuenow={index + (phase === "reveal" ? 1 : 0)} aria-valuemin={0} aria-valuemax={progress}>
        {cases.map((_, i) => (
          <span
            key={i}
            className={`academy-progress__dot ${
              i < index ? "academy-progress__dot--done" : i === index ? "academy-progress__dot--current" : ""
            }`}
          />
        ))}
      </div>

      {phase === "question" ? (
        <div className="academy-round__question" ref={questionRef} tabIndex={-1}>
          <CaseDisplay caseItem={current} showFlags={false} />
          <p className="muted small academy-round__prompt">Is this a scam or genuine?</p>
          <div className="academy-round__actions">
            <button
              type="button"
              className="btn btn-danger academy-round__btn-scam"
              onClick={() => submit(true)}
              aria-keyshortcuts="S"
            >
              Scam <kbd>S</kbd>
            </button>
            <button
              type="button"
              className="btn btn-primary academy-round__btn-safe"
              onClick={() => submit(false)}
              aria-keyshortcuts="G"
            >
              Looks genuine <kbd>G</kbd>
            </button>
          </div>
        </div>
      ) : (
        <RevealPanel
          caseItem={current}
          result={lastResult}
          onNext={handleNext}
          isLast={index + 1 >= cases.length}
        />
      )}
    </div>
  );
}
