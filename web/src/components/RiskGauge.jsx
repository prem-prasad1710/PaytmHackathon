import { useEffect, useState } from "react";
import { riskColor } from "../utils/riskStyles";

const RADIUS = 70;
const ARC = Math.PI * RADIUS;

export default function RiskGauge({ score = 0, risk = "Caution" }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const color = riskColor(risk);
  const angle = -90 + (shown / 100) * 180;

  return (
    <div className={`gauge ${risk === "High Risk" ? "gauge-shake" : ""}`} role="img" aria-label={`Risk score ${score} out of 100, ${risk}`}>
      <svg viewBox="0 0 180 110">
        <path d="M20 90 A70 70 0 0 1 160 90" className="gauge-track" />
        <path
          d="M20 90 A70 70 0 0 1 160 90"
          className="gauge-fill"
          stroke={color}
          strokeDasharray={ARC}
          strokeDashoffset={ARC * (1 - shown / 100)}
        />
        <g className="gauge-needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: "90px 90px" }}>
          <line x1="90" y1="90" x2="90" y2="30" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx="90" cy="90" r="6" fill={color} />
        </g>
        <text x="90" y="82" textAnchor="middle" className="gauge-score" fill="currentColor" dy="-14">
          {score}
        </text>
      </svg>
      <div className="gauge-label" style={{ color }}>
        {risk}
      </div>
    </div>
  );
}
