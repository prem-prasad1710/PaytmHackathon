function fmtPct(v) {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtMs(ms) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function StatCards({ stats }) {
  if (!stats) return null;
  const precision = stats.alertPrecision;
  const ci = stats.alertPrecisionCi;
  const sample = stats.alertPrecisionSampleSize || 0;

  return (
    <div className="console-stats" data-testid="console-stats">
      <div className="console-stat">
        <strong>{stats.open ?? 0}</strong>
        <span>Open cases</span>
      </div>
      <div className="console-stat">
        <strong>{stats.reviewed ?? 0}</strong>
        <span>Reviewed</span>
      </div>
      <div className="console-stat">
        <strong>{fmtPct(precision)}</strong>
        <span>Alert precision</span>
        {ci && sample > 0 && (
          <div className="ci">95% CI {fmtPct(ci.low)}–{fmtPct(ci.high)} (n={sample})</div>
        )}
      </div>
      <div className="console-stat">
        <strong>{fmtPct(stats.falsePositiveRate)}</strong>
        <span>False-positive rate</span>
      </div>
      <div className="console-stat">
        <strong>{fmtMs(stats.medianReviewTimeMs)}</strong>
        <span>Median review time</span>
      </div>
    </div>
  );
}
