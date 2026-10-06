const MODES = {
  full: { label: "Full stack", hint: "Server + ML", tone: "safe" },
  server: { label: "Server only", hint: "API up · ML offline", tone: "warn" },
  offline: { label: "On-device offline", hint: "Rules engine on this device", tone: "muted" },
  grok: { label: "Live Grok", hint: "LLM assist (verdict from engines)", tone: "info" },
};

/**
 * Honest provenance badge.
 * mode: 'full' | 'server' | 'offline' | 'grok'
 */
export default function StatusBadge({ mode = "offline", detail }) {
  const m = MODES[mode] || MODES.offline;
  return (
    <span
      className={`status-badge tone-${m.tone}`}
      title={detail || m.hint}
      data-testid="status-badge"
      data-mode={mode}
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{m.label}</span>
      <span className="status-hint">{detail || m.hint}</span>
    </span>
  );
}

/** Infer mode from an analyze/fraud API result. */
export function inferStatusMode(result) {
  if (!result) return "offline";
  const src = result.source;
  if (src === "grok") return "grok";
  if (src === "mock" || src === "qr-analyzer") return "offline";
  if (src === "hybrid" || result.mlAvailable === true || result.ml?.available === true) return "full";
  if (result.score_breakdown?.ml != null && result.score_breakdown.ml !== undefined) {
    // score_breakdown.ml can be null when ML offline on server
    if (result.score_breakdown.ml === null) return "server";
    return "full";
  }
  if (src === "api" || src === "hybrid" || result.score_breakdown) return "server";
  if (result.mlAvailable === false) return "server";
  return "offline";
}
