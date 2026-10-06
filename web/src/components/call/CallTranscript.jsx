function highlightSnippets(text, tactics) {
  if (!tactics?.length) return [{ text, flagged: false }];

  const snippets = tactics.map((t) => t.snippet).filter(Boolean);
  if (!snippets.length) return [{ text, flagged: false }];

  const lower = text.toLowerCase();
  const ranges = [];
  for (const snip of snippets) {
    const idx = lower.indexOf(snip.toLowerCase());
    if (idx >= 0) ranges.push({ start: idx, end: idx + snip.length });
  }
  if (!ranges.length) return [{ text, flagged: false }];

  ranges.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r.start > last.end) merged.push({ ...r });
    else last.end = Math.max(last.end, r.end);
  }

  const parts = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) parts.push({ text: text.slice(cursor, r.start), flagged: false });
    parts.push({ text: text.slice(r.start, r.end), flagged: true });
    cursor = r.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), flagged: false });
  return parts;
}

export default function CallTranscript({ utterances = [] }) {
  if (!utterances.length) {
    return (
      <div className="call-transcript-empty">
        <p className="muted">No transcript yet.</p>
        <p className="small muted">
          Start listening, type what the caller says, or play a sample call. Flagged scam phrases will appear here.
        </p>
      </div>
    );
  }

  return (
    <ol className="call-transcript-list" aria-label="Call transcript">
      {utterances.map((line) => (
        <li key={line.index} className={`call-transcript-line ${line.tactics.length ? "call-transcript-flagged" : ""}`}>
          <div className="call-transcript-text">
            {highlightSnippets(line.text, line.tactics).map((part, i) =>
              part.flagged ? (
                <mark key={i} className="call-highlight">{part.text}</mark>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </div>
          {line.tactics.length > 0 && (
            <div className="call-transcript-chips">
              {line.tactics.map((t) => (
                <span key={t.id} className="chip chip-danger">{t.label}</span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
