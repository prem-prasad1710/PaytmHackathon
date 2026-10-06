export default function ScamDna({ result, onClose }) {
  if (!result) return null;
  const dna = result.ml?.scamDna || [];
  const best = dna[0];
  const close = best && best.similarity >= 0.5;

  return (
    <section className="panel stack" data-testid="dna-panel">
      <div className="ml-head">
        <div>
          <span className="eyebrow">Scam DNA</span>
          <h3 style={{ margin: 0 }}>{!result.ml.available ? "Unavailable without the ML service" : close ? `Closest pattern: ${best.label}` : "No close match to a known scam family"}</h3>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        The transaction's feature profile is compared (cosine similarity) with the average profile of each scam family in the training data. It is a similarity
        measure, not a classification, and it does not change the decision.
      </p>

      {dna.map((d) => (
        <div key={d.type} className="dna-row">
          <div className="engine-head">
            <strong>{d.label}</strong>
            <span className="small">{(d.similarity * 100).toFixed(0)}% similar · {d.sampleCount} training examples</span>
          </div>
          <div className="bar"><div className={`bar-fill ${d.similarity >= 0.5 ? "bar-danger" : "bar-none"}`} style={{ width: `${Math.max(2, d.similarity * 100)}%` }} /></div>
          <div className="chip-row">
            {d.signature.slice(0, 5).map((s) => (
              <span key={s.feature} className="chip" title={`${s.z > 0 ? "+" : ""}${s.z} standard deviations from the typical transaction`}>
                {s.label} {s.z > 0 ? "↑" : "↓"}
              </span>
            ))}
          </div>
        </div>
      ))}
      {!dna.length && result.ml.available && <p className="muted small">No scam DNA data was returned by the model.</p>}
    </section>
  );
}
