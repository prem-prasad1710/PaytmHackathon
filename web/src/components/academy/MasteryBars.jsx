import { TACTICS, tacticLabel, weakestTactic } from "../../utils/academyEngine.js";

export default function MasteryBars({ mastery }) {
  const weak = weakestTactic(mastery, 1);
  return (
    <div className="academy-mastery" aria-label="Tactic mastery">
      {TACTICS.map((t) => {
        const m = mastery[t] || { correct: 0, total: 0 };
        const pct = m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0;
        const isWeak = t === weak && m.total >= 1;
        return (
          <div key={t} className={`academy-mastery__row ${isWeak ? "academy-mastery__row--weak" : ""}`}>
            <div className="academy-mastery__label">
              <span>{tacticLabel(t)}</span>
              <span className="muted small">
                {m.total > 0 ? `${pct}% (${m.correct}/${m.total})` : "—"}
              </span>
            </div>
            <div className="academy-mastery__track">
              <div className="academy-mastery__fill" style={{ width: `${pct}%` }} />
            </div>
            {isWeak && <span className="academy-mastery__tag">Focus here</span>}
          </div>
        );
      })}
    </div>
  );
}
