import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { DEMO_QR_PAYLOADS } from "../utils/upiQr";

const MAX_DIM = 1280;

function decodeCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
}

export default function QrScanner({ onDecoded, disabled }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const fileRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [preview, setPreview] = useState("");

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
      const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0, canvas.width, canvas.height);
      const code = decodeCanvas(canvas);
      if (code?.data) {
        stopCamera();
        onDecoded(code.data);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onDecoded, stopCamera]);

  async function startCamera() {
    setError("");
    setPreview("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not available here (needs https or localhost). Upload a QR image instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        rafRef.current = requestAnimationFrame(tick);
      });
    } catch (err) {
      setError(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access or upload a QR image."
          : "Could not open the camera. Upload a QR image instead."
      );
    }
  }

  async function handleFile(file) {
    if (!file) return;
    setError("");
    stopCamera();
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("bad image"));
        el.src = url;
      });
      const canvas = canvasRef.current;
      const scales = [1, 0.5, 0.25];
      let code = null;
      for (const s of scales) {
        const base = Math.min(1, MAX_DIM / Math.max(img.width, img.height)) * s;
        canvas.width = Math.max(64, Math.round(img.width * base));
        canvas.height = Math.max(64, Math.round(img.height * base));
        canvas.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0, canvas.width, canvas.height);
        code = decodeCanvas(canvas);
        if (code) break;
      }
      if (!code?.data) {
        setError("No QR code found in that image. Try a sharper, closer photo or screenshot.");
        return;
      }
      onDecoded(code.data);
    } catch {
      setError("Could not read that image.");
    }
  }

  return (
    <div className="stack">
      <div className="qr-stage">
        {cameraOn ? (
          <>
            <video ref={videoRef} playsInline muted className="qr-video" />
            <div className="qr-frame" aria-hidden="true">
              <span className="qr-laser" />
            </div>
          </>
        ) : preview ? (
          <img src={preview} alt="Uploaded QR" className="qr-preview" />
        ) : (
          <div className="qr-placeholder">
            <div className="qr-glyph" aria-hidden="true">▣</div>
            <p>Scan any payment QR before you pay</p>
            <span className="muted small">Decoded and analysed on your device. Nothing is uploaded.</span>
          </div>
        )}
        <canvas ref={canvasRef} hidden />
      </div>

      <div className="row-actions" style={{ marginTop: 0 }}>
        {cameraOn ? (
          <button type="button" className="btn btn-secondary" onClick={stopCamera}>
            Stop camera
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={startCamera} disabled={disabled}>
            Scan with camera
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={disabled}>
          Upload QR image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <details className="manual">
        <summary>No QR handy? Try demo QR payloads or paste one</summary>
        <div className="sample-row" style={{ marginTop: "0.6rem" }}>
          {DEMO_QR_PAYLOADS.map((d) => (
            <button key={d.label} type="button" className="chip" disabled={disabled} onClick={() => onDecoded(d.payload)}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="manual-row">
          <input
            type="text"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="upi://pay?pa=name@bank&pn=Shop&am=100"
            aria-label="QR payload text"
          />
          <button type="button" className="btn btn-secondary" disabled={!manual.trim() || disabled} onClick={() => onDecoded(manual.trim())}>
            Analyse
          </button>
        </div>
      </details>
    </div>
  );
}
