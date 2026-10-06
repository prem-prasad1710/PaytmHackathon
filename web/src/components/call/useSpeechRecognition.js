import { useCallback, useEffect, useRef, useState } from "react";

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechSupported() {
  return Boolean(getSpeechRecognition());
}

export function useSpeechRecognition({ lang = "en-IN", onResult, onError }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef(null);
  const wantListenRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    setListening(false);
    setInterim("");
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      onErrorRef.current?.({ type: "unsupported" });
      return;
    }
    wantListenRef.current = true;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          onResultRef.current?.({ text: transcript, final: true });
          setInterim("");
        } else {
          interimText += transcript;
        }
      }
      if (interimText) setInterim(interimText);
    };

    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wantListenRef.current = false;
        setListening(false);
        onErrorRef.current?.({ type: "denied", error: event.error });
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        onErrorRef.current?.({ type: "error", error: event.error });
      }
    };

    rec.onend = () => {
      if (wantListenRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      wantListenRef.current = false;
      setListening(false);
      onErrorRef.current?.({ type: "error", error: err.message });
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      wantListenRef.current = false;
      recRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!listening || !recRef.current) return;
    recRef.current.lang = lang;
  }, [lang, listening]);

  return { listening, interim, start, stop, supported: isSpeechSupported() };
}
