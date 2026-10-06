export default function PlaybookTimeline({ playbook, compact = false }) {
  if (!playbook) return null;
  const { stages, stageIndex, stageCount, name, nameHi, nextAsk, youAreHere, youAreHereHi, confidence } = playbook;

  return (
    <section className={`panel playbook-timeline ${compact ? "compact" : ""}`} data-testid="playbook-timeline">
      <header className="section-head" style={{ marginBottom: "0.75rem" }}>
        <div>
          <span className="eyebrow">Scammer's playbook</span>
          <h3 style={{ margin: "0.15rem 0" }}>{name}</h3>
          <p className="muted small" style={{ margin: 0 }}>{nameHi}</p>
        </div>
        <span className="pill pill-purple">Stage {stageIndex + 1}/{stageCount}</span>
      </header>

      <p className="playbook-here" role="status">{youAreHere}</p>
      {!compact && <p className="muted small">{youAreHereHi}</p>}

      <ol className="playbook-stages">
        {stages.map((s, i) => (
          <li key={s.id} className={`pb-stage pb-${s.state}`}>
            <span className="pb-index" aria-hidden="true">{i + 1}</span>
            <div>
              <strong>{s.label}</strong>
              <div className="muted small">{s.labelHi}</div>
              {s.state === "current" && (
                <div className="pb-next">Next they will ask: {nextAsk || s.nextAsk}</div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {typeof confidence === "number" && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          Match confidence {Math.round(confidence * 100)}% · offline template detection
        </p>
      )}
    </section>
  );
}
