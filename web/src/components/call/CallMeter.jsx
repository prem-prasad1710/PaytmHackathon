import { useEffect, useState } from "react";
import { riskLevelColor } from "../../utils/callTactics";

const RADIUS = 90;
const ARC = Math.PI * RADIUS;

export default function CallMeter({ score = 0, level = "CALM", source = "tactics" }) {
  const [shown, setShown] = useState(0);
  const color = riskLevelColor(level);
  const angle = -90 + (shown / 100) * 180;
  const shake = level === "HANG UP NOW" || level === "LIKELY SCAM";

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const sourceLabel =
    source === "both"
      ? "Combined: rules + text model"
      : source === "model"
        ? "Text model"
        : "Scam tactic rules";

  return (
    <div
      className={`call-meter ${shake ? "call-meter-shake" : ""}`}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Call risk score ${score} out of 100. Status: ${level}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <svg viewBox="0 0 220 130" className="call-meter-svg">
        <path d="M20 110 A90 90 0 0 1 200 110" className="call-meter-track" />
        <path
          d="M20 110 A90 90 0 0 1 200 110"
          className="call-meter-fill"
          stroke={color}
          strokeDasharray={ARC}
          strokeDashoffset={ARC * (1 - shown / 100)}
        />
        <g
          className="call-meter-needle"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "110px 110px" }}
        >
          <line x1="110" y1="110" x2="110" y2="35" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <circle cx="110" cy="110" r="7" fill={color} />
        </g>
        <text x="110" y="95" textAnchor="middle" className="call-meter-score" fill="currentColor">
          {score}
        </text>
      </svg>
      <div className="call-meter-status" style={{ color }}>
        {level}
      </div>
      <p className="call-meter-source muted small">{sourceLabel}</p>
    </div>
  );
}
