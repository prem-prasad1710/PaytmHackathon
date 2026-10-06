export default function DualExplain({ dual }) {
  if (!dual?.user || !dual?.analyst) return null;
  const a = dual.analyst;

  return (
    <section className="dual-explain" data-testid="dual-explain">
      <div className="dual-user">
        <span className="eyebrow">For you · Hinglish</span>
        <p style={{ margin: "0.35rem 0 0", fontWeight: 650 }}>{dual.user.headline}</p>
        <ul className="gp-reasons" style={{ marginTop: "0.55rem" }}>
          {(dual.user.lines || []).slice(1, 4).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Template explanation{dual.user.generatedBy?.includes("llm") ? " (LLM rephrased wording only)" : ""} — verdict unchanged.
        </p>
      </div>
      <div className="dual-analyst">
        <span className="eyebrow">Analyst / bank view</span>
        <table className="analyst-table">
          <tbody>
            <tr><td>Verdict</td><td><strong>{a.verdict}</strong>{a.riskScore != null ? ` · ${a.riskScore}/100` : a.score != null ? ` · ${a.score}/100` : ""}</td></tr>
            {(a.signals || []).map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td>
                  {s.value == null ? "—" : s.value}
                  {s.weight != null ? ` · weight ${Math.round(s.weight * 100)}%` : ""}
                </td>
              </tr>
            ))}
            {a.ruleIds?.length > 0 && (
              <tr><td>Rule / flag IDs</td><td>{a.ruleIds.join(", ")}</td></tr>
            )}
            {a.ml && a.ml.probability != null && (
              <tr><td>Model</td><td>{a.ml.model || a.ml.modelVersion || "ML"} · p={Number(a.ml.probability).toFixed(3)}</td></tr>
            )}
            {a.playbookId && (
              <tr><td>Playbook</td><td>{a.playbookId}{a.playbookStage ? ` · stage ${a.playbookStage}` : ""}</td></tr>
            )}
            {a.coercionFlags?.length > 0 && (
              <tr><td>Coercion</td><td>{a.coercionFlags.join(", ")}</td></tr>
            )}
            {a.overrides?.length > 0 && (
              <tr><td>Overrides</td><td>{a.overrides.join(", ")}</td></tr>
            )}
          </tbody>
        </table>
        <p className="muted small" style={{ margin: "0.5rem 0 0" }}>
          {a.note || "Engines decide. LLM may only rephrase the user summary."}
        </p>
      </div>
    </section>
  );
}
