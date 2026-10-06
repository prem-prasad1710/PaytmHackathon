import { useCallback, useEffect, useRef, useState } from "react";
import LabHero from "../components/fraud/LabHero.jsx";
import CaseCards from "../components/fraud/CaseCards.jsx";
import MlIntelligence from "../components/fraud/MlIntelligence.jsx";
import DecisionCard from "../components/fraud/DecisionCard.jsx";
import LiveStream, { ThreatAlert } from "../components/fraud/LiveStream.jsx";
import NetworkGraph from "../components/fraud/NetworkGraph.jsx";
import ScamDna from "../components/fraud/ScamDna.jsx";
import { fetchNetwork, fetchOverview, nextStream, resetLab, runScenario } from "../services/fraudApi";

const STREAM_INTERVAL_MS = 1400;
const MAX_ITEMS = 40;
const EMPTY_COUNTS = { total: 0, SAFE: 0, WARNING: 0, BLOCK: 0 };

export default function FraudLab() {
  const [overview, setOverview] = useState(null);
  const [selected, setSelected] = useState(null);
  const [activeCase, setActiveCase] = useState("");
  const [story, setStory] = useState("");
  const [network, setNetwork] = useState(null);
  const [dna, setDna] = useState(null);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [threat, setThreat] = useState(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const sinceRefresh = useRef(0);
  const decisionRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setOverview(await fetchOverview());
      setError("");
    } catch {
      setError("The API server is not reachable. Start it with npm run dev:server.");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!running) return undefined;
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const { decisions } = await nextStream(1);
        if (cancelled) return;
        const d = decisions[0];
        setItems((prev) => [d, ...prev].slice(0, MAX_ITEMS));
        setCounts((c) => ({ ...c, total: c.total + 1, [d.decision]: c[d.decision] + 1 }));
        if (d.decision === "BLOCK") setThreat(d);
        sinceRefresh.current += 1;
        if (sinceRefresh.current >= 4 || d.decision === "BLOCK") {
          sinceRefresh.current = 0;
          refresh();
        }
        timer = setTimeout(tick, STREAM_INTERVAL_MS);
      } catch {
        if (!cancelled) {
          setRunning(false);
          setError("Live stream stopped: the API server is not reachable.");
        }
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      refresh();
    };
  }, [running, refresh]);

  const choose = useCallback((decision, storyText = "", caseId = "") => {
    setSelected(decision);
    setStory(storyText);
    setActiveCase(caseId);
    setDna(null);
    requestAnimationFrame(() => decisionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }, []);

  const runCase = async (name) => {
    setBusy(name);
    try {
      const out = await runScenario(name);
      choose(out.decision, out.story, name);
      setNetwork(null);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const investigate = useCallback(async (accountId) => {
    try {
      setNetwork(await fetchNetwork(accountId));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const reset = async () => {
    setRunning(false);
    try {
      await resetLab();
    } catch (e) {
      setError(e.message);
    }
    setItems([]);
    setCounts(EMPTY_COUNTS);
    setThreat(null);
    setSelected(null);
    setActiveCase("");
    setStory("");
    setNetwork(null);
    setDna(null);
    refresh();
  };

  return (
    <div className="fraud-lab">
      <div className="stack">
        <LabHero overview={overview} onReset={reset} />
        <CaseCards scenarios={overview?.scenarios} busy={busy} activeCase={activeCase} onRun={runCase} />
        {error && <div className="error-banner" role="alert">{error}</div>}
        <ThreatAlert
          threat={threat}
          onView={(d) => choose(d, "")}
          onInvestigate={investigate}
          onDismiss={() => setThreat(null)}
        />
      </div>

      <div className="lab-grid">
        <div className="stack lab-main">
          <div ref={decisionRef} className="scroll-anchor">
            {selected ? (
              <>
                {story && <p className="case-note" data-testid="case-story">{story}</p>}
                <DecisionCard result={selected} onInvestigate={investigate} onDna={(r) => setDna(r)} />
              </>
            ) : (
              <div className="panel empty-decision" data-testid="empty-decision">
                <div className="empty-icon" aria-hidden="true">⚡</div>
                <h3>No payment selected</h3>
                <p className="muted">Run one of the three demo cases above, or start the live stream and click any payment to see how each engine scored it.</p>
              </div>
            )}
          </div>
          {dna && <ScamDna result={dna} onClose={() => setDna(null)} />}
          {network && <NetworkGraph network={network} onClose={() => setNetwork(null)} />}
          <MlIntelligence overview={overview} />
        </div>

        <aside className="lab-side">
          <LiveStream
            items={items}
            running={running}
            onToggle={() => setRunning((v) => !v)}
            onSelect={(d) => choose(d, "")}
            selectedId={selected?.id}
            counts={counts}
          />
        </aside>
      </div>
    </div>
  );
}
