import { xpProgress } from "../../utils/academyEngine.js";

export default function XpBar({ xp }) {
  const { level, pct, current, next } = xpProgress(xp);
  return (
    <div className="academy-xp" aria-label={`Level ${level}, ${xp} XP`}>
      <div className="academy-xp__header">
        <span className="academy-level">Lv {level}</span>
        <span className="muted small">{xp} XP</span>
      </div>
      <div className="academy-xp__track" role="progressbar" aria-valuenow={xp} aria-valuemin={current} aria-valuemax={next}>
        <div className="academy-xp__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
