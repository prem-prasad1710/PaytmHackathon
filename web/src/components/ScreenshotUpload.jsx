import { useEffect, useRef, useState } from "react";

export default function ScreenshotUpload({ onAnalyze, disabled }) {
  const fileRef = useRef(null);
  const urlRef = useRef("");
  const [preview, setPreview] = useState("");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const busy = status === "reading";

  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), []);

  async function readFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose an image (PNG, JPG, WebP).");
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(file);
    setPreview(urlRef.current);
    setError("");
    setText("");
    setProgress(0);
    setStatus("reading");
    try {
      const mod = await import("tesseract.js");
      const Tesseract = mod.default ?? mod;
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const extracted = (data.text || "").replace(/\n{3,}/g, "\n\n").trim();
      setText(extracted);
      setStatus("done");
      if (!extracted) setError("No readable text found. Try a clearer screenshot.");
    } catch (err) {
      console.error(err);
      setStatus("");
      setError("Text recognition failed (it needs internet the first time to fetch the OCR engine). You can type the text instead.");
    }
  }

  return (
    <div className="stack">
      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          readFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Screenshot preview" className="shot-preview" />
        ) : (
          <>
            <div className="qr-glyph" aria-hidden="true">🖼</div>
            <p>Drop a screenshot here or click to upload</p>
            <span className="muted small">
              WhatsApp / SMS chats, payment receipts, "KYC" messages. Text is read on your device.
            </span>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => readFile(e.target.files?.[0])} />
      </div>

      {busy && (
        <div className="panel loading" role="status">
          <span className="spinner" aria-hidden="true" />
          Reading text... {progress}%
          <div className="progress"><span style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {(status === "done" || error) && (
        <div className="stack">
          <label htmlFor="ocr-text"><strong>Extracted text (edit if needed)</strong></label>
          <textarea
            id="ocr-text"
            className="ocr-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste the message text here"
          />
          <div className="row-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!text.trim() || disabled}
              onClick={() => onAnalyze(text.trim())}
            >
              Analyse this screenshot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
