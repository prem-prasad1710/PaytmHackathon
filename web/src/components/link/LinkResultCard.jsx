const VERDICT_META = {
  SAFE: { label: "Safe", className: "ls-verdict-safe", risk: "Safe" },
  SUSPICIOUS: { label: "Suspicious", className: "ls-verdict-caution", risk: "Caution" },
  DANGEROUS: { label: "Dangerous", className: "ls-verdict-danger", risk: "High Risk" },
};

function DomainAnatomy({ anatomy, host }) {
  if (!anatomy || !host) return null;
  const parts = [
    { key: "subdomain", label: "Subdomain", value: anatomy.subdomain },
    { key: "registrableDomain", label: "Real site", value: anatomy.registrableDomain },
    { key: "tld", label: "TLD", value: `.${anatomy.tld}` },
  ].filter((p) => p.value);

  return (
    <div className="ls-anatomy" aria-label="Domain breakdown">
      <div className="ls-anatomy-bar">
        {parts.map((p) => (
          <span
            key={p.key}
            className={`ls-anatomy-seg ${anatomy.highlight === p.key ? "ls-anatomy-focus" : ""}`}
            title={p.label}
          >
            <em>{p.label}</em>
            <strong>{p.value}</strong>
          </span>
        ))}
      </div>
      {anatomy.imitatedBrand && (
        <p className="muted small ls-anatomy-note">
          This address may be imitating <strong>{anatomy.imitatedBrand}</strong> — the highlighted part is what you actually visit.
        </p>
      )}
    </div>
  );
}

export default function LinkResultCard({ result }) {
  const meta = VERDICT_META[result.verdict] || VERDICT_META.SUSPICIOUS;
  const ringDeg = Math.min(100, Math.max(0, result.score)) * 3.6;

  return (
    <article className={`ls-result ${meta.className}`} aria-labelledby={`ls-title-${result.input.slice(0, 12)}`}>
      <header className="ls-result-head">
        <div className={`ls-verdict-banner ${meta.className}`} id={`ls-title-${result.input.slice(0, 12)}`}>
          <span className="ls-verdict-text">{meta.label}</span>
          <span className="ls-verdict-score">{result.score}/100</span>
        </div>
        <div
          className="ls-risk-ring"
          style={{ "--ring-deg": `${ringDeg}deg` }}
          role="img"
          aria-label={`Risk score ${result.score} out of 100`}
        >
          <span>{result.score}</span>
        </div>
      </header>

      <div className="ls-input-block">
        <span className="small muted">Checked address (not clickable)</span>
        <code className="ls-input-code">{result.input}</code>
      </div>

      {result.host && <DomainAnatomy anatomy={result.anatomy} host={result.host} />}

      {result.signals.length > 0 && (
        <div className="ls-signals">
          <h4>What we noticed</h4>
          <ul>
            {result.signals.map((s) => (
              <li key={s.id}>
                <div className="ls-signal-top">
                  <strong>{s.label}</strong>
                  <span className="ls-weight">{Math.round(s.weight * 100)}%</span>
                </div>
                <p className="muted small">{s.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.officialDomain && result.brandMatch && (
        <div className="ls-official">
          <h4>Open the official site instead</h4>
          <p className="small">
            If you need <strong>{result.brandMatch.brand}</strong>, go to{" "}
            <code className="ls-official-domain">{result.officialDomain}</code> by typing it yourself — not via this link.
          </p>
        </div>
      )}

      {result.advice?.length > 0 && (
        <div className="ls-advice">
          <h4>Safe next steps</h4>
          <ul>
            {result.advice.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function verdictToRisk(verdict) {
  return VERDICT_META[verdict]?.risk || "Caution";
}
