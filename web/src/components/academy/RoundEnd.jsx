import { BADGE_DEFS, tacticLabel } from "../../utils/academyEngine.js";
import MasteryBars from "./MasteryBars.jsx";

export default function RoundEnd({
  result,
  state,
  mode,
  onHome,
  onPlayAgain,
  shareStatus,
  onShare,
}) {
  const { correctCount, total, roundXp, newBadges, nextState } = result;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const roundMastery = {};
  for (const a of result.answers || []) {
    for (const t of a.caseItem.tactics || []) {
      if (!roundMastery[t]) roundMastery[t] = { correct: 0, total: 0 };
      roundMastery[t].total += 1;
      if (a.userSaysScam === a.caseItem.isScam) roundMastery[t].correct += 1;
    }
  }

  const tacticRows = Object.entries(roundMastery).filter(([, v]) => v.total > 0);

  return (
    <div className="academy-end stack">
      <section className="panel academy-end__hero">
        <h2 style={{ marginTop: 0 }}>
          {pct === 100 ? "Perfect round! ⭐" : pct >= 70 ? "Great work! 🛡️" : "Keep practising!"}
        </h2>
        <div className="academy-end__score">
          <span className="academy-end__big">{correctCount}/{total}</span>
          <span className="muted">correct ({pct}%)</span>
        </div>
        <p className="academy-end__xp">+{roundXp} XP earned</p>
        {newBadges.length > 0 && (
          <div className="academy-end__badges">
            <strong>New badges!</strong>
            <div className="academy-end__badge-list">
              {newBadges.map((id) => {
                const b = BADGE_DEFS.find((d) => d.id === id);
                return b ? (
                  <span key={id} className="chip">{b.icon} {b.name}</span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </section>

      {tacticRows.length > 0 && (
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>This round by tactic</h3>
          <ul className="academy-end__tactics">
            {tacticRows.map(([t, v]) => (
              <li key={t}>
                <span>{tacticLabel(t)}</span>
                <span>{v.correct}/{v.total}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Overall mastery</h3>
        <MasteryBars mastery={nextState.mastery} />
      </section>

      <div className="academy-end__actions">
        <button type="button" className="btn btn-primary" onClick={onShare}>
          {shareStatus || "Share score"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onPlayAgain}>
          Play again
        </button>
        <button type="button" className="btn btn-secondary" onClick={onHome}>
          Back to hub
        </button>
      </div>
    </div>
  );
}
