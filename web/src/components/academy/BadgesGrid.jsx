import { BADGE_DEFS } from "../../utils/academyEngine.js";

export default function BadgesGrid({ earned = [] }) {
  const set = new Set(earned);
  return (
    <div className="academy-badges" role="list" aria-label="Badges">
      {BADGE_DEFS.map((b) => {
        const unlocked = set.has(b.id);
        return (
          <div
            key={b.id}
            className={`academy-badge ${unlocked ? "academy-badge--unlocked" : "academy-badge--locked"}`}
            role="listitem"
            title={b.desc}
          >
            <span className="academy-badge__icon" aria-hidden="true">{unlocked ? b.icon : "🔒"}</span>
            <strong className="academy-badge__name">{b.name}</strong>
            <span className="muted small">{b.desc}</span>
          </div>
        );
      })}
    </div>
  );
}
