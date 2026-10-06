import { useCallback, useEffect, useRef, useState } from "react";
import StatCards from "../components/console/StatCards.jsx";
import CaseQueue from "../components/console/CaseQueue.jsx";
import CaseDetail from "../components/console/CaseDetail.jsx";
import {
  exportFeedback,
  fetchCase,
  fetchCases,
  fetchMlHealth,
  fetchStats,
  reviewCase,
  seedCases,
} from "../services/consoleApi.js";
import "../styles/console.css";

const STATUS_FILTERS = [
  { id: "", label: "All" },
  { id: "open", label: "Open" },
  { id: "confirmed_fraud", label: "Confirmed" },
  { id: "false_positive", label: "False +" },
  { id: "escalated", label: "Escalated" },
];

const DECISION_FILTERS = [
  { id: "", label: "Any decision" },
  { id: "WARNING", label: "Warning" },
  { id: "BLOCK", label: "Block" },
];

export default function AnalystConsole() {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [sort, setSort] = useState("age");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [mlDown, setMlDown] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);
  const listRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [s, c, health] = await Promise.all([
        fetchStats(),
        fetchCases({ status: statusFilter || undefined, decision: decisionFilter || undefined, sort, limit: 100 }),
        fetchMlHealth().catch(() => null),
      ]);
      setStats(s);
      setCases(c.cases || []);
      setMlDown(health ? !health.mlAvailable : false);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load console data");
    }
  }, [statusFilter, decisionFilter, sort]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [autoRefresh, refresh]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCase(null);
      return;
    }
    let cancelled = false;
    fetchCase(selectedId)
      .then((data) => {
        if (!cancelled) {
          setSelectedCase(data.case);
          setNote(data.case.analystNote || "");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => { cancelled = true; };
  }, [selectedId, cases]);

  const selectCase = useCallback((id) => {
    setSelectedId(id);
    setMobileDetail(true);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (!cases.length) return;
      const idx = cases.findIndex((c) => c.id === selectedId);
      if (e.key === "j" || e.key === "J") {
        const next = cases[Math.min(cases.length - 1, idx + 1)] || cases[0];
        selectCase(next.id);
      }
      if (e.key === "k" || e.key === "K") {
        const prev = cases[Math.max(0, idx - 1)] || cases[cases.length - 1];
        selectCase(prev.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cases, selectedId, selectCase]);

  const handleReview = async (verdict) => {
    if (!selectedId) return;
    setBusy(verdict);
    const prev = selectedCase;
    setSelectedCase({ ...prev, status: verdict === "escalate" ? "escalated" : verdict, analystNote: note });
    try {
      const { case: updated } = await reviewCase(selectedId, { verdict, note });
      setSelectedCase(updated);
      await refresh();
    } catch (e) {
      setSelectedCase(prev);
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const handleSeed = async () => {
    setBusy("seed");
    try {
      await seedCases(25);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const handleExport = async () => {
    setBusy("export");
    try {
      const res = await exportFeedback();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fraud-feedback.jsonl";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="console-page" data-testid="analyst-console">
      <header className="console-header">
        <h1>Analyst Console</h1>
        <p className="muted">Human-in-the-loop review of fraud alerts. Every WARNING and BLOCK becomes a case; your feedback becomes labelled training data.</p>
      </header>

      {mlDown && (
        <div className="console-banner warn" role="status">
          ML service is offline — cases still use graph and rule engines. Scores may lack ML component.
        </div>
      )}

      {error && <div className="error-banner" role="alert">{error}</div>}

      <StatCards stats={stats} />

      <div className="console-toolbar panel" style={{ padding: "0.75rem 1rem" }}>
        <div className="console-filters" role="group" aria-label="Status filters">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              type="button"
              className={`chip${statusFilter === f.id ? " active" : ""}`}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="console-filters" role="group" aria-label="Decision filters">
          {DECISION_FILTERS.map((f) => (
            <button
              key={f.id || "any"}
              type="button"
              className={`chip${decisionFilter === f.id ? " active" : ""}`}
              onClick={() => setDecisionFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="console-sort">
          <label className="small muted" htmlFor="sort-select">Sort</label>
          <select id="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="age">Newest</option>
            <option value="score">Highest score</option>
          </select>
          <label className="small">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
        </div>
        <div className="console-filters">
          <button type="button" className="btn btn-secondary" onClick={handleSeed} disabled={busy === "seed"} data-testid="seed-btn">
            Populate demo cases
          </button>
          <span className="chip">simulated data</span>
          <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={busy === "export"} data-testid="export-btn">
            Export labelled feedback (JSONL)
          </button>
        </div>
      </div>

      <div className="console-info">
        <strong>How feedback is used:</strong> exported labels are for the next offline retraining run; this console does not retrain the model automatically.
      </div>

      <div className="console-layout">
        <div className={mobileDetail ? "hidden-mobile" : ""}>
          <CaseQueue cases={cases} selectedId={selectedId} onSelect={selectCase} listRef={listRef} />
        </div>
        <div className={!mobileDetail && !selectedId ? "" : mobileDetail ? "" : "hidden-mobile"}>
          {mobileDetail && (
            <button type="button" className="btn btn-secondary console-mobile-back" onClick={() => setMobileDetail(false)}>
              ← Back to queue
            </button>
          )}
          <CaseDetail
            caseRecord={selectedCase}
            note={note}
            setNote={setNote}
            busy={Boolean(busy)}
            onReview={handleReview}
          />
        </div>
      </div>
    </div>
  );
}
