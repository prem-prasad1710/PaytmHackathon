import { useEffect, useState } from "react";

export default function AnalyzingSteps({ steps }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    const id = setInterval(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), 650);
    return () => clearInterval(id);
  }, [steps]);

  return (
    <div className="panel analyzing" role="status" aria-live="polite">
      <div className="analyzing-bar"><span /></div>
      <ul>
        {steps.map((s, i) => (
          <li key={s} className={i < index ? "done" : i === index ? "active" : ""}>
            <span className="step-icon">{i < index ? "✓" : i === index ? <span className="spinner" /> : "·"}</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
