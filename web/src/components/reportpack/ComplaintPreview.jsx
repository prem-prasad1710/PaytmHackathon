import { useState } from "react";
import { buildReportPack, downloadTextFile } from "../../utils/reportPack.js";

export default function ComplaintPreview({ data }) {
  const [lang, setLang] = useState("en");
  const [copied, setCopied] = useState(false);
  const pack = buildReportPack(data);

  const complaintText = lang === "hi" ? pack.complaintHindi : pack.complaintEnglish;
  const fullExport = [
    "=== CYBERCRIME REPORT PACK (guidance only) ===",
    "",
    "--- ENGLISH COMPLAINT ---",
    pack.complaintEnglish,
    "",
    "--- HINDI COMPLAINT ---",
    pack.complaintHindi,
    "",
    "--- SCAMMER DETAILS ---",
    pack.scammerDetails,
    "",
    "--- BANK DISPUTE EMAIL ---",
    `Subject: ${pack.bankEmail.subject}`,
    "",
    pack.bankEmail.body,
  ].join("\n");

  async function copyText() {
    try {
      await navigator.clipboard.writeText(complaintText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: "Cybercrime report pack",
        text: complaintText.slice(0, 5000),
      });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="form-section stack">
      <div className="section-head">
        <h3 style={{ margin: 0 }}>Complaint preview</h3>
        <div className="lang-toggle no-print" role="group" aria-label="Language">
          <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
            English
          </button>
          <button type="button" className={lang === "hi" ? "active" : ""} onClick={() => setLang("hi")}>
            हिन्दी
          </button>
        </div>
      </div>

      {pack.missingFields.filter((m) => m.severity === "critical").length > 0 && (
        <div className="missing-fields" role="alert">
          <strong>Missing critical details:</strong>
          <ul>
            {pack.missingFields
              .filter((m) => m.severity === "critical")
              .map((m) => (
                <li key={m.field}>{m.message}</li>
              ))}
          </ul>
        </div>
      )}

      <div className="preview-box" aria-label="Complaint text preview">
        {complaintText}
      </div>

      <details className="no-print">
        <summary className="small">Scammer details block</summary>
        <div className="preview-box" style={{ marginTop: "0.5rem", maxHeight: 160 }}>
          {pack.scammerDetails}
        </div>
      </details>

      <details className="no-print">
        <summary className="small">Bank / UPI dispute email</summary>
        <div className="preview-box" style={{ marginTop: "0.5rem", maxHeight: 200 }}>
          <strong>Subject:</strong> {pack.bankEmail.subject}
          {"\n\n"}
          {pack.bankEmail.body}
        </div>
      </details>

      <div className="row-actions no-print">
        <button type="button" className="btn btn-primary" onClick={copyText}>
          {copied ? "Copied!" : "Copy text"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => downloadTextFile("cybercrime-report-pack.txt", fullExport)}>
          Download .txt
        </button>
        <button type="button" className="btn btn-secondary" onClick={handlePrint}>
          Print / Save PDF
        </button>
        {typeof navigator !== "undefined" && navigator.share && (
          <button type="button" className="btn btn-secondary" onClick={handleShare}>
            Share
          </button>
        )}
      </div>
    </div>
  );
}
