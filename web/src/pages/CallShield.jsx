import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeText } from "../services/analyzeApi";
import { addCheck } from "../utils/store";
import { analyzeCall, riskLevel } from "../utils/callTactics";
import { CALL_SCRIPTS } from "../data/callScripts";
import CallMeter from "../components/call/CallMeter";
import CallControls from "../components/call/CallControls";
import CallTranscript from "../components/call/CallTranscript";
import TacticTimeline from "../components/call/TacticTimeline";
import HangUpPanel from "../components/call/HangUpPanel";
import { useSpeechRecognition } from "../components/call/useSpeechRecognition";
import "../styles/callShield.css";

function modelScoreFromResult(result) {
  if (!result) return 0;
  if (typeof result.score === "number") return Math.round(result.score);
  const risk = String(result.risk || "");
  if (risk.includes("High")) return 85;
  if (risk.includes("Caution")) return 45;
  return 10;
}

function modelRiskLabel(result) {
  if (!result) return null;
  const score = modelScoreFromResult(result);
  const risk = result.risk || "Unknown";
  return { score, risk, label: `Text model: ${score}% scam (${risk})` };
}

export default function CallShield() {
  const [utterances, setUtterances] = useState([]);
  const [lang, setLang] = useState("en-IN");
  const [manualLine, setManualLine] = useState("");
  const [scriptId, setScriptId] = useState(CALL_SCRIPTS[0].id);
  const [playingScript, setPlayingScript] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [modelResult, setModelResult] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const scriptTimerRef = useRef(null);
  const modelAbortRef = useRef(0);
  const linesSinceModelRef = useRef(0);

  const addUtterance = useCallback((text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    setUtterances((prev) => [...prev, { text: trimmed, at: Date.now() }]);
    setSaved(false);
  }, []);

  const handleSpeechResult = useCallback(
    ({ text, final }) => {
      if (final) addUtterance(text);
    },
    [addUtterance]
  );

  const handleSpeechError = useCallback((err) => {
    if (err.type === "denied") setSpeechError("denied");
  }, []);

  const { listening, interim, start, stop, supported } = useSpeechRecognition({
    lang,
    onResult: handleSpeechResult,
    onError: handleSpeechError,
  });

  const callAnalysis = useMemo(() => analyzeCall(utterances), [utterances]);
  const tacticScore = callAnalysis.score;
  const modelScore = modelScoreFromResult(modelResult);
  const finalScore = Math.max(tacticScore, modelScore);
  const finalLevel = riskLevel(finalScore);
  const scoreSource =
    modelScore > tacticScore ? "model" : modelScore < tacticScore && modelScore > 0 ? "tactics" : modelScore === tacticScore && modelScore > 0 ? "both" : "tactics";

  const fullTranscript = utterances.map((u) => u.text).join("\n");
  const summary = `Call Shield: ${finalLevel} (${finalScore}/100). Tactics: ${callAnalysis.tactics.map((t) => t.label).join(", ") || "none"}.`;

  useEffect(() => {
    if (utterances.length < 2) return;
    linesSinceModelRef.current += 1;
    if (linesSinceModelRef.current < 2) return;
    linesSinceModelRef.current = 0;

    const text = utterances.map((u) => u.text).join("\n");
    const runId = ++modelAbortRef.current;
    setModelLoading(true);

    analyzeText(text)
      .then((data) => {
        if (runId === modelAbortRef.current) setModelResult(data);
      })
      .catch(() => {
        if (runId === modelAbortRef.current) setModelResult(null);
      })
      .finally(() => {
        if (runId === modelAbortRef.current) setModelLoading(false);
      });
  }, [utterances]);

  useEffect(() => {
    return () => {
      if (scriptTimerRef.current) clearTimeout(scriptTimerRef.current);
    };
  }, []);

  function toggleListen() {
    if (listening) {
      stop();
    } else {
      setSpeechError(null);
      start();
    }
  }

  function handleLangChange(next) {
    if (listening) stop();
    setLang(next);
  }

  function handleAddLine() {
    addUtterance(manualLine);
    setManualLine("");
  }

  function handleClear() {
    stop();
    if (scriptTimerRef.current) clearTimeout(scriptTimerRef.current);
    setPlayingScript(false);
    setUtterances([]);
    setModelResult(null);
    setSaved(false);
    linesSinceModelRef.current = 0;
  }

  function playScript() {
    const script = CALL_SCRIPTS.find((s) => s.id === scriptId);
    if (!script) return;
    handleClear();
    setPlayingScript(true);
    let i = 0;

    const playNext = () => {
      if (i >= script.lines.length) {
        setPlayingScript(false);
        return;
      }
      const line = script.lines[i];
      addUtterance(line.text);
      i += 1;
      scriptTimerRef.current = setTimeout(playNext, line.delay);
    };
    scriptTimerRef.current = setTimeout(playNext, 600);
  }

  function stopScript() {
    if (scriptTimerRef.current) clearTimeout(scriptTimerRef.current);
    setPlayingScript(false);
  }

  function handleSave() {
    addCheck({
      kind: "message",
      input: fullTranscript.slice(0, 280),
      result: {
        risk: finalLevel === "HANG UP NOW" || finalLevel === "LIKELY SCAM" ? "High Risk" : finalLevel === "BE CAREFUL" ? "Caution" : "Safe",
        score: finalScore,
        hindi_summary: summary,
        source: scoreSource,
      },
    });
    setSaved(true);
  }

  const modelInfo = modelRiskLabel(modelResult);

  return (
    <div className="call-shield-page">
      <header className="call-shield-header">
        <h2>Call Shield</h2>
        <p className="muted">
          Open this while on a suspicious call. We listen for scam tactics and show a live risk meter.
        </p>
      </header>

      {finalLevel === "HANG UP NOW" && (
        <HangUpPanel
          summary={summary}
          risk="High Risk"
          score={finalScore}
          onSave={handleSave}
          saved={saved}
        />
      )}

      <div className="call-shield-layout">
        <div className="call-shield-left panel stack">
          <CallMeter score={finalScore} level={finalLevel} source={scoreSource} />

          {modelLoading && <p className="small muted call-model-loading" aria-live="polite">Checking with text model…</p>}
          {modelInfo && !modelLoading && (
            <p className="call-model-verdict small" aria-live="polite">{modelInfo.label}</p>
          )}

          <CallControls
            listening={listening}
            interim={interim}
            supported={supported}
            speechError={speechError}
            lang={lang}
            onLangChange={handleLangChange}
            onToggleListen={toggleListen}
            manualLine={manualLine}
            onManualLineChange={setManualLine}
            onAddLine={handleAddLine}
            scriptId={scriptId}
            onScriptChange={setScriptId}
            scripts={CALL_SCRIPTS}
            playingScript={playingScript}
            onPlayScript={playScript}
            onStopScript={stopScript}
            onClear={handleClear}
          />

          <details className="call-privacy-note">
            <summary>Privacy note</summary>
            <p className="small muted">
              Live listening uses your browser&apos;s speech engine (Chrome/Safari may send audio to their cloud
              service). We never store or upload audio. The transcript stays on this device unless you save it to
              history or open the report pack.
            </p>
          </details>
        </div>

        <div className="call-shield-right stack">
          <section className="panel call-transcript-panel">
            <h3>Live transcript</h3>
            <CallTranscript utterances={callAnalysis.utterances} />
          </section>

          <section className="panel call-timeline-panel">
            <h3>Tactic timeline</h3>
            <TacticTimeline timeline={callAnalysis.timeline} />
          </section>
        </div>
      </div>
    </div>
  );
}
