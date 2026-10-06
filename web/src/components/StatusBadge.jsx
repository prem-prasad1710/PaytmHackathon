const MODES = {
  full: { label: "Full stack", hint: "Server + ML", tone: "safe" },
  server: { label: "Server only", hint: "API up · ML offline", tone: "warn" },
  offline: { label: "On-device offline", hint: "Rules engine on this device", tone: "muted" },
  grok: { label: "Live Grok", hint: "LLM rephrase / analyze", tone: "info" },
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
  if (result.source === "grok") return "grok";
  if (result.source === "mock" || result.source === "qr-analyzer") return "offline";
  if (result.mlAvailable === true || result.ml?.available === true || result.score_breakdown?.ml != null) {
    return "full";
  }
  if (result.source === "hybrid" || result.source === "api" || result.score_breakdown) return "server";
  return "offline";
}
