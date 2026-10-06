import { useEffect, useMemo, useState } from "react";
import { STATE_TILES, TRENDING_ALERTS } from "../data/threatSeed";
import { COMPLAINT_REGISTRY } from "../services/offlineEngine";
import { fetchThreatStats } from "../services/communityApi";
import ReportForm from "../components/ReportForm.jsx";
import { useStoreValue, getLocalReports } from "../utils/store";

export default function ThreatMap() {
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState("DL");
  const [showReport, setShowReport] = useState(false);
  const localReports = useStoreValue(getLocalReports);

  useEffect(() => {
    let alive = true;
    fetchThreatStats().then((s) => alive && setStats(s));
    return () => {
      alive = false;
    };
  }, [localReports.length]);

  const max = useMemo(() => (stats ? Math.max(...Object.values(stats.byState), 1) : 1), [stats]);
  const ranked = useMemo(
    () => (stats ? Object.entries(stats.byState).sort((a, b) => b[1] - a[1]).map(([c]) => c) : []),
    [stats]
  );
  const sel = STATE_TILES.find((s) => s.code === selected);
  const selCount = stats?.byState[selected] || 0;

  const flagged = useMemo(() => {
    const live = (stats?.topEntities || []).map((e) => ({ entity: e.entity, count: e.count, label: "Live community reports" }));
    const seed = [...COMPLAINT_REGISTRY]
      .sort((a, b) => b.complaints - a.complaints)
      .slice(0, 6)
      .map((e) => ({ entity: e.entity, count: e.complaints, label: e.label }));
    const merged = new Map();
    for (const e of [...seed, ...live]) {
      merged.set(e.entity, { ...e, count: Math.max(e.count, merged.get(e.entity)?.count || 0) });
    }
    return [...merged.values()].sort((a, b) => b.count - a.count).slice(0, 7);
  }, [stats]);

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="section-head">
          <div>
            <h2 style={{ margin: 0 }}>Community threat map</h2>
            <p className="muted" style={{ margin: "0.3rem 0 0" }}>
              Scam reports by state. Reported UPI IDs and numbers feed straight back into detection.
            </p>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => setShowReport((v) => !v)}>
            {showReport ? "Close" : "Report a scam"}
          </button>
        </div>

        {showReport && (
          <div className="feature">
            <ReportForm />
          </div>
        )}

        <div className="map-layout">
          <div>
            <div className="tile-map" role="group" aria-label="India scam reports by state">
              {STATE_TILES.map((s) => {
                const count = stats?.byState[s.code] || 0;
                const heat = count / max;
                return (
                  <button
                    key={s.code}
                    type="button"
                    className={`tile ${heat > 0.5 ? "hot" : ""} ${selected === s.code ? "selected" : ""}`}
                    style={{ gridColumn: s.col + 1, gridRow: s.row + 1, "--heat": heat.toFixed(2) }}
                    onClick={() => setSelected(s.code)}
                    title={`${s.name}: ${count} reports`}
                    aria-label={`${s.name}, ${count} reports`}
                    aria-pressed={selected === s.code}
                  >
                    <span>{s.code}</span>
                    <em>{count}</em>
                  </button>
                );
              })}
            </div>
            <div className="heat-legend" aria-hidden="true">
              <span>Fewer</span>
              <i />
              <span>More reports</span>
            </div>
          </div>

          <aside className="map-side">
            {sel && stats && (
              <div className="selected-card">
                <h3>{sel.name}</h3>
                <div className="big-num">{selCount.toLocaleString("en-IN")}</div>
                <span className="muted small">reports · rank #{ranked.indexOf(selected) + 1} of {ranked.length}</span>
              </div>
            )}
            {stats && (
              <p className="muted small" style={{ margin: 0 }}>
                {stats.liveTotal} live report{stats.liveTotal === 1 ? "" : "s"} on top of{" "}
                {stats.seedTotal.toLocaleString("en-IN")} sample baseline reports.{" "}
                {stats.serverOnline ? "Server connected." : "Server offline: showing this device only."}
              </p>
            )}
          </aside>
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Scam types this week</h3>
          <ul className="cat-list">
            {(stats?.categories || []).slice(0, 7).map((c) => {
              const top = stats.categories[0].count || 1;
              return (
                <li key={c.name}>
                  <div className="cat-top">
                    <span>{c.name}</span>
                    <span className={c.trend > 0 ? "trend-up" : "trend-down"}>
                      {c.trend > 0 ? "▲" : c.trend < 0 ? "▼" : "-"} {Math.abs(c.trend)}%
                    </span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.count / top) * 100}%`, background: "var(--danger)" }} /></div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Most-reported senders</h3>
          <ul className="flagged">
            {flagged.map((e) => (
              <li key={e.entity}>
                <div className="grow">
                  <code>{e.entity}</code>
                  <div className="muted small">{e.label}</div>
                </div>
                <span className="pill pill-high">{e.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Stay alert</h3>
        <div className="alert-grid">
          {TRENDING_ALERTS.map((a) => (
            <article key={a.id} className={`trend trend-${a.severity}`}>
              <h3>{a.title}</h3>
              <p>{a.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
