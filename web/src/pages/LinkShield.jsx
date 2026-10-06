import { useRef, useState } from "react";
import { analyzeUrl, extractUrls } from "../services/linkEngine.js";
import LinkResultCard, { verdictToRisk } from "../components/link/LinkResultCard.jsx";
import { addCheck } from "../utils/store.js";
import "../styles/linkShield.css";

const SAMPLES = [
  { label: "Official Paytm", value: "https://paytm.com", tone: "safe" },
  { label: "Google Pay", value: "https://pay.google.com", tone: "safe" },
  { label: "SBI official", value: "https://sbi.co.in", tone: "safe" },
  { label: "Wikipedia", value: "https://wikipedia.org", tone: "safe" },
  { label: "Fake Paytm KYC", value: "https://paytm-kyc-verify.xyz/login", tone: "bad" },
  { label: "Typosquat paytrn.com", value: "https://paytrn.com/verify", tone: "bad" },
  { label: "Short link trap", value: "https://bit.ly/paytm-refund", tone: "bad" },
  { label: "Subdomain trick", value: "https://paytm.com.secure-login.xyz/", tone: "bad" },
  { label: "UPI collect scam", value: "upi://collect?pa=refund@upi&pn=Cashback&am=1", tone: "bad" },
  { label: "SMS with 2 links", value: "Paytm KYC pending! Update at https://pay-tm.support/kyc or call back.", tone: "bad" },
];

function toHistoryResult(result) {
  const risk = verdictToRisk(result.verdict);
  const topSignal = result.signals[0]?.label;
  return {
    risk,
    score: result.score,
    hindi_summary: topSignal
      ? `${result.verdict}: ${topSignal}`
      : `${result.verdict} link check`,
    source: "link-shield",
  };
}

export default function LinkShield() {
  const inputRef = useRef(null);
  const [text, setText] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function runAnalysis(input) {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Paste a link or message containing a URL.");
      setResults([]);
      return;
    }
    if (trimmed.length > 2000) {
      setError("Input is too long (max 2000 characters).");
      setResults([]);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const urls = extractUrls(trimmed);
      if (!urls.length) {
        const single = analyzeUrl(trimmed);
        if (single.signals.some((s) => s.id === "invalid_url")) {
          setError("No valid URL found. Paste a full link (https://…) or a UPI link.");
          setResults([]);
          return;
        }
        setResults([single]);
        addCheck({ kind: "message", input: trimmed, result: toHistoryResult(single) });
      } else {
        const analyzed = urls.map((u) => analyzeUrl(u));
        setResults(analyzed);
        const worst = analyzed.reduce((a, b) => (b.score > a.score ? b : a), analyzed[0]);
        addCheck({ kind: "message", input: trimmed, result: toHistoryResult(worst) });
      }
    } catch (err) {
      setError(err.message || "Could not analyze this input.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runAnalysis(text);
  }

  function handleSample(value) {
    setText(value);
    runAnalysis(value);
    inputRef.current?.focus();
  }

  return (
    <div className="stack ls-page">
      <section className="panel stack ls-hero">
        <div>
          <span className="eyebrow">Phishing & UPI links</span>
          <h2>Link Shield</h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Paste a suspicious link or an entire SMS. We break down the domain, spot brand impersonation, and flag risky patterns — fully offline.
          </p>
        </div>

        <form className="ls-input-wrap" onSubmit={handleSubmit}>
          <label htmlFor="link-input" className="small">
            Link or message
          </label>
          <textarea
            id="link-input"
            ref={inputRef}
            className="ls-textarea"
            placeholder="Paste a URL, UPI link, or SMS with links…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                runAnalysis(text);
              }
            }}
            rows={4}
            maxLength={2000}
            aria-describedby="link-input-hint"
          />
          <span id="link-input-hint" className="muted small">
            Detects up to 10 links in one message. Press Enter with Ctrl/Cmd to check.
          </span>
          <div className="ls-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Checking…" : "Check link"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setText("");
                setResults([]);
                setError("");
              }}
            >
              Clear
            </button>
          </div>
        </form>

        <div>
          <span className="small muted">Try a sample</span>
          <div className="ls-samples" role="group" aria-label="Sample links">
            {SAMPLES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`chip ${s.tone === "bad" ? "chip-bad" : ""}`}
                onClick={() => handleSample(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-banner" role="alert">{error}</div>}
      </section>

      {!results.length && !error && !loading && (
        <section className="panel ls-empty" aria-live="polite">
          <p className="muted" style={{ margin: 0 }}>
            No results yet. Paste a link above or tap a sample chip to see how Link Shield works.
          </p>
        </section>
      )}

      {results.length > 0 && (
        <section className="ls-results" aria-live="polite">
          {results.map((r) => (
            <LinkResultCard key={`${r.input}-${r.score}`} result={r} />
          ))}
        </section>
      )}

      <section className="panel feature ls-limits">
        <h3 style={{ marginTop: 0 }}>How this works / limits</h3>
        <p className="muted" style={{ margin: 0 }}>
          Link Shield uses deterministic heuristics on your device — no reputation feed, no live crawl of the destination.
          It cannot know if a brand-new domain is malicious, only whether the URL structure looks like known phishing tricks
          (typosquats, fake subdomains, shorteners, UPI collect links, scam keywords). Always verify payments inside your
          official banking or wallet app.
        </p>
      </section>
    </div>
  );
}
