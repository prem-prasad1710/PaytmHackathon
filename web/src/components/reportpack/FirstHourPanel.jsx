import { useEffect, useState } from "react";
import { ACTION_STEPS, timeSinceIncident } from "../../utils/reportPack.js";

const STORAGE_KEY = "ss_report_pack_actions";

function loadChecked() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveChecked(checked) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  } catch {
    /* ignore */
  }
}

export default function FirstHourPanel({ incidentAt }) {
  const [checked, setChecked] = useState(loadChecked);
  const [elapsed, setElapsed] = useState(() =>
    incidentAt ? timeSinceIncident(incidentAt) : null
  );

  useEffect(() => {
    if (!incidentAt) {
      setElapsed(null);
      return;
    }
    const tick = () => setElapsed(timeSinceIncident(incidentAt));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [incidentAt]);

  function toggle(id) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveChecked(next);
      return next;
    });
  }

  const doneCount = ACTION_STEPS.filter((s) => checked[s.id]).length;

  return (
    <section className="first-hour-panel stack" aria-labelledby="first-hour-heading">
      <div>
        <span className="eyebrow">First hour</span>
        <h2 id="first-hour-heading" style={{ margin: "0.35rem 0 0" }}>
          Act fast — the sooner the better
        </h2>
        <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
          Guidance only, not legal advice. Reporting quickly may help freeze funds — but outcomes depend on your bank and authorities.
        </p>
      </div>

      {elapsed ? (
        <div>
          <div className="muted small">Time since incident</div>
          <div className={`first-hour-timer ${elapsed.urgent ? "urgent" : ""}`} aria-live="polite">
            {elapsed.label}
          </div>
        </div>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>
          Set the incident time below to start the timer.
        </p>
      )}

      <div>
        <div className="muted small" style={{ marginBottom: "0.5rem" }}>
          Action checklist ({doneCount}/{ACTION_STEPS.length})
        </div>
        <ol className="action-checklist">
          {ACTION_STEPS.map((step, i) => (
            <li key={step.id}>
              <input
                type="checkbox"
                id={`action-${step.id}`}
                checked={Boolean(checked[step.id])}
                onChange={() => toggle(step.id)}
              />
              <label htmlFor={`action-${step.id}`}>
                <strong>{i + 1}.</strong> {step.label}
                {step.id === "helpline" && (
                  <a className="helpline-btn no-print" href="tel:1930" style={{ marginTop: "0.5rem" }}>
                    📞 Call 1930
                  </a>
                )}
                {step.id === "portal" && (
                  <a
                    className="btn btn-secondary no-print"
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginTop: "0.5rem", width: "fit-content" }}
                  >
                    Open cybercrime.gov.in
                  </a>
                )}
              </label>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
