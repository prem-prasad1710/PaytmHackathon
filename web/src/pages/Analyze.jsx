import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatInput from "../components/ChatInput.jsx";
import SampleScenarios from "../components/SampleScenarios.jsx";
import RiskCard from "../components/RiskCard.jsx";
import QrScanner from "../components/QrScanner.jsx";
import ScreenshotUpload from "../components/ScreenshotUpload.jsx";
import AnalyzingSteps from "../components/AnalyzingSteps.jsx";
import GuardianOverlay from "../components/GuardianOverlay.jsx";
import { analyzeText } from "../services/analyzeApi";
import { extractEntities } from "../services/offlineEngine";
import { analyzeQrPayload } from "../utils/upiQr";
import { analyzePaymentScreenshot } from "../utils/screenshotChecks";
import { addCheck } from "../utils/store";
import {
  extractPaymentMeta,
  resolvePrimaryAction,
  resolveSecondaryAction,
} from "../utils/paymentFlow";

const TABS = [
  { id: "qr", label: "Scan QR", icon: "▣" },
  { id: "message", label: "Paste message", icon: "✉" },
  { id: "screenshot", label: "Screenshot", icon: "🖼" },
];

const STEPS = {
  qr: ["Decoding QR code", "Reading payee, amount and note", "Checking handle and community reports", "Scoring risk"],
  message: ["Reading message", "Looking up UPI IDs and phone numbers", "Running scam model", "Combining verdict"],
  screenshot: ["Reading text from screenshot", "Looking up UPI IDs and phone numbers", "Running scam model", "Checking receipt details"],
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Analyze() {
  const navigate = useNavigate();
  const location = useLocation();
  const resultRef = useRef(null);

  const [tab, setTab] = useState(location.state?.tab || "qr");
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [sourceText, setSourceText] = useState("");
  const [extra, setExtra] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stepsKey, setStepsKey] = useState("message");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [overlay, setOverlay] = useState(false);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  function reset() {
    setResult(null);
    setSourceText("");
    setExtra(null);
    setToast("");
    setError("");
    setOverlay(false);
  }

  function finish(data, kind, input, extraFindings = null) {
    setResult(data);
    setSourceText(input);
    setExtra(extraFindings);
    addCheck({ kind, input, result: data });
    if (data.risk === "High Risk") setOverlay(true);
  }

  async function runText(value, kind) {
    reset();
    setStepsKey(kind === "screenshot" ? "screenshot" : "message");
    setLoading(true);
    try {
      const [data] = await Promise.all([analyzeText(value), delay(700)]);
      finish(data, kind, value, kind === "screenshot" ? analyzePaymentScreenshot(value) : null);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleQr(payload) {
    reset();
    const local = analyzeQrPayload(payload);
    if (!local) {
      await runText(payload, "qr");
      return;
    }
    setStepsKey("qr");
    setLoading(true);
    await delay(900);
    setLoading(false);
    finish(local, "qr", payload);
  }

  function paymentState(extraState = {}) {
    const base = result?.payment
      ? {
          amount: result.payment.amount || "₹0",
          payee: result.payment.payee,
          entity: result.payment.entity,
          collect: result.payment.collect,
          summary: result.hindi_summary,
        }
      : (() => {
          const meta = extractPaymentMeta(sourceText, result);
          const { upis, mobiles } = extractEntities(sourceText);
          return {
            amount: meta.amount,
            payee: meta.payee,
            entity: upis[0] || mobiles[0] || "",
            summary: meta.summary,
          };
        })();
    return {
      ...base,
      note: base.payee,
      risk: result?.risk,
      category: result?.ml?.category?.label,
      ...extraState,
    };
  }

  function handlePrimary() {
    if (!result) return;
    const action = resolvePrimaryAction(result);
    if (action === "confirm_pay") navigate("/confirm-pay", { state: paymentState({ warned: false }) });
    else if (action === "verify") navigate("/verify", { state: paymentState() });
    else if (action === "block") navigate("/blocked", { state: paymentState({ reported: false }) });
  }

  function handleSecondary() {
    if (!result) return;
    const action = resolveSecondaryAction(result);
    if (action === "continue_anyway") {
      navigate("/confirm-pay", {
        state: paymentState({ warned: true, summary: "Continue Anyway selected after Caution warning." }),
      });
    } else if (action === "report") {
      navigate("/blocked", { state: paymentState({ reported: true }) });
    } else if (action === "tips") {
      setToast("Shield tip: sirf official biller / saved contacts se pay karo.");
    }
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <h2 style={{ marginTop: 0 }}>Check before you pay</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Scan a QR, paste a message or upload a screenshot. Shield combines rules, a trained ML model
            and community reports. It works offline too.
          </p>
        </div>

        <div className="tabs" role="tablist" aria-label="Input type">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => {
                setTab(t.id);
                reset();
              }}
            >
              <span aria-hidden="true">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {tab === "qr" && <QrScanner onDecoded={handleQr} disabled={loading} />}

        {tab === "message" && (
          <>
            <SampleScenarios
              disabled={loading}
              onSelect={(sample) => {
                setText(sample);
                reset();
              }}
            />
            <ChatInput value={text} onChange={setText} onAnalyze={() => runText(text, "message")} loading={loading} />
          </>
        )}

        {tab === "screenshot" && <ScreenshotUpload onAnalyze={(t) => runText(t, "screenshot")} disabled={loading} />}
      </section>

      {loading && <AnalyzingSteps steps={STEPS[stepsKey]} />}

      {error && <div className="error-banner">{error}</div>}
      {toast && <div className="panel toast-panel">{toast}</div>}

      <div ref={resultRef}>
        {!loading && result && (
          <RiskCard
            result={result}
            sourceText={sourceText}
            extraFindings={extra}
            extraFindingsTitle="Payment screenshot checks"
            onPrimary={handlePrimary}
            onSecondary={handleSecondary}
          />
        )}
      </div>

      {overlay && result && (
        <GuardianOverlay
          result={result}
          onClose={() => setOverlay(false)}
          onBlock={() => navigate("/blocked", { state: paymentState({ reported: false }) })}
          onReport={() => navigate("/blocked", { state: paymentState({ reported: true }) })}
        />
      )}
    </div>
  );
}
