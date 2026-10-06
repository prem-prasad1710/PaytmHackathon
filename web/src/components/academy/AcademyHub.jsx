import { CHANNELS } from "../../utils/academyEngine.js";
import XpBar from "./XpBar.jsx";
import BadgesGrid from "./BadgesGrid.jsx";
import MasteryBars from "./MasteryBars.jsx";

const CHANNEL_LABELS = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  call: "Calls",
  qr: "QR codes",
  email: "Email",
  "upi-request": "UPI requests",
};

export default function AcademyHub({
  state,
  today,
  dailyDone,
  dailyScore,
  onStartDaily,
  onStartPractice,
  weakest,
}) {
  return (
    <div className="academy-hub stack">
      <section className="panel academy-hero">
        <div className="academy-hero__top">
          <div>
            <h2 style={{ marginTop: 0 }}>Scam Academy</h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              Spot scams before they spot you. Train on realistic SMS, calls, QR traps and more.
            </p>
          </div>
          {state.dayStreak > 0 && (
            <div className="academy-streak" aria-label={`${state.dayStreak} day streak`}>
              <span className="academy-streak__flame" aria-hidden="true">🔥</span>
              <strong>{state.dayStreak}</strong>
              <span className="muted small">day streak</span>
            </div>
          )}
        </div>
        <XpBar xp={state.xp} />
      </section>

      <section className="panel academy-daily">
        <div className="academy-daily__header">
          <h3 style={{ margin: 0 }}>Today's challenge</h3>
          <span className="chip">{today}</span>
        </div>
        <p className="muted">
          10 cases, same set for everyone today. Earn XP, keep your streak, unlock badges.
        </p>
        {dailyDone ? (
          <div className="academy-daily__done">
            <span className="badge badge-safe">Completed</span>
            <span>
              Score: <strong>{dailyScore?.score}/{dailyScore?.total}</strong>
            </span>
            <button type="button" className="btn btn-secondary" onClick={onStartDaily}>
              Play again
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onStartDaily}>
            Start daily challenge
          </button>
        )}
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Free practice</h3>
        <p className="muted small">Drill one channel or mix all cases.</p>
        <div className="academy-channels">
          <button type="button" className="btn btn-secondary" onClick={() => onStartPractice("all")}>
            All channels
          </button>
          {CHANNELS.map((ch) => (
            <button
              key={ch}
              type="button"
              className="btn btn-secondary academy-channel-btn"
              onClick={() => onStartPractice(ch)}
            >
              {CHANNEL_LABELS[ch]}
            </button>
          ))}
        </div>
      </section>

      {weakest && (
        <section className="panel academy-tip">
          <strong>💡 Tip:</strong> Your weakest area is <em>{weakest.replace(/_/g, " ")}</em>. Focus on cases using that tactic.
        </section>
      )}

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Badges</h3>
        <BadgesGrid earned={state.badges} />
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Tactic mastery</h3>
        <MasteryBars mastery={state.mastery} />
      </section>

      {state.totalAnswered > 0 && (
        <p className="muted small academy-stats">
          Lifetime: {state.totalCorrect}/{state.totalAnswered} correct across {state.totalRounds} rounds
        </p>
      )}
    </div>
  );
}
