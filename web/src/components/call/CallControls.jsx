export default function CallControls({
  listening,
  interim,
  supported,
  speechError,
  lang,
  onLangChange,
  onToggleListen,
  manualLine,
  onManualLineChange,
  onAddLine,
  scriptId,
  onScriptChange,
  scripts,
  playingScript,
  onPlayScript,
  onStopScript,
  onClear,
}) {
  return (
    <div className="call-controls stack">
      {!supported && (
        <div className="call-speech-unsupported" role="status">
          <strong>Speech recognition not supported</strong>
          <p className="small muted">
            Your browser cannot listen live (Firefox lacks this API). Paste what the caller says below or play a
            scripted sample — both work fully.
          </p>
        </div>
      )}

      {speechError === "denied" && (
        <div className="error-banner" role="alert">
          Microphone permission denied. You can still type or paste caller lines below.
        </div>
      )}

      <div className="call-controls-row">
        <button
          type="button"
          className={`btn ${listening ? "btn-danger" : "btn-primary"} call-mic-btn`}
          onClick={onToggleListen}
          disabled={!supported}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Start listening"}
        >
          <span className={`call-mic-dot ${listening ? "call-mic-dot-active" : ""}`} aria-hidden="true" />
          {listening ? "Stop listening" : "Start listening"}
        </button>

        <label className="call-lang-toggle">
          <span className="small muted">Language</span>
          <select value={lang} onChange={(e) => onLangChange(e.target.value)} disabled={listening}>
            <option value="en-IN">English (India)</option>
            <option value="hi-IN">Hindi (India)</option>
          </select>
        </label>
      </div>

      {listening && interim && (
        <p className="call-interim muted small" aria-live="polite">
          Hearing: {interim}
        </p>
      )}

      <form
        className="call-manual-form"
        onSubmit={(e) => {
          e.preventDefault();
          onAddLine();
        }}
      >
        <label htmlFor="call-manual-input" className="small muted">
          Type or paste what the caller said
        </label>
        <div className="call-manual-row">
          <input
            id="call-manual-input"
            type="text"
            value={manualLine}
            onChange={(e) => onManualLineChange(e.target.value)}
            placeholder="Caller says…"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-secondary" disabled={!manualLine.trim()}>
            Add line
          </button>
        </div>
      </form>

      <div className="call-sample-block">
        <label htmlFor="call-script-select" className="small muted">
          Play sample call <span className="call-sample-tag">scripted sample, not real audio</span>
        </label>
        <div className="call-sample-row">
          <select
            id="call-script-select"
            value={scriptId}
            onChange={(e) => onScriptChange(e.target.value)}
            disabled={playingScript}
          >
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          {playingScript ? (
            <button type="button" className="btn btn-secondary" onClick={onStopScript}>
              Stop sample
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={onPlayScript}>
              Play sample
            </button>
          )}
        </div>
      </div>

      <button type="button" className="btn btn-secondary call-clear-btn" onClick={onClear}>
        Clear transcript
      </button>
    </div>
  );
}
