export default function ChatInput({ value, onChange, onAnalyze, loading }) {
  return (
    <div className="chat-input stack">
      <label htmlFor="payment-text">
        <strong>Paste SMS / UPI request / chat</strong>
      </label>
      <textarea
        id="payment-text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="English / Hindi / Hinglish paste karo — e.g. lotery prize, ओटीपी बता दो, electricity bill..."
      />
      <div className="row-actions" style={{ marginTop: 0 }}>
        <button className="btn btn-primary" onClick={onAnalyze} disabled={loading || !value.trim()}>
          {loading ? "Checking..." : "Check with Shield"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => onChange("")}
          disabled={loading}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
