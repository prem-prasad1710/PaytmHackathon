export default function TacticTimeline({ timeline = [] }) {
  if (!timeline.length) {
    return <p className="muted small">No scam tactics detected yet.</p>;
  }

  return (
    <ol className="call-timeline" aria-label="Detected scam tactics timeline">
      {timeline.map((t, i) => (
        <li key={t.id} className="call-timeline-item">
          <span className="call-timeline-num" aria-hidden="true">{i + 1}</span>
          <div>
            <strong>{t.label}</strong>
            <p className="small muted">{t.why}</p>
            {t.snippet && (
              <p className="small call-timeline-snippet">
                Matched: &ldquo;{t.snippet}&rdquo;
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
