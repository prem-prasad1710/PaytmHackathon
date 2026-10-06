import { useMemo } from "react";
import { highlightSegments } from "../utils/highlight";

const KIND_LABEL = {
  link: "Suspicious link",
  upi: "UPI ID",
  phone: "Phone number",
  word: "Risky phrase",
};

export default function HighlightedMessage({ text, mlTokens }) {
  const segments = useMemo(() => highlightSegments(text, mlTokens), [text, mlTokens]);
  if (!text || !segments.some((s) => s.hit)) return null;

  return (
    <div className="hl-wrap">
      <strong>What the model noticed</strong>
      <p className="hl-text">
        {segments.map((s, i) =>
          s.hit ? (
            <mark
              key={i}
              className={`hl hl-${s.kind}`}
              style={{ "--i": s.intensity }}
              title={KIND_LABEL[s.kind]}
            >
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </p>
      <div className="hl-legend">
        <span><i className="dot dot-word" /> Risky phrase</span>
        <span><i className="dot dot-link" /> Link</span>
        <span><i className="dot dot-upi" /> UPI ID</span>
        <span><i className="dot dot-phone" /> Phone</span>
      </div>
    </div>
  );
}
