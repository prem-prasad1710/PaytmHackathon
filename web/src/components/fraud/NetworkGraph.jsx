import { useMemo } from "react";

const W = 760;
const H = 440;
const CX = W / 2;
const CY = H / 2;

function layout(nodes, mulePath) {
  const pos = new Map();
  const target = nodes.find((n) => n.role === "target");
  if (target) pos.set(target.id, { x: CX, y: CY });

  const spread = (list, radius, start, end) => {
    list.forEach((n, i) => {
      const t = list.length === 1 ? (start + end) / 2 : start + ((end - start) * i) / (list.length - 1);
      pos.set(n.id, { x: CX + radius * Math.cos(t), y: CY + radius * Math.sin(t) });
    });
  };

  const payers = nodes.filter((n) => n.role === "payer");
  const mules = (mulePath || []).map((h) => nodes.find((n) => n.id === h.to)).filter(Boolean);
  const near = nodes.filter(
    (n) => n.role !== "target" && n.role !== "payer" && n.role !== "mule" && n.hop <= 1 && !mules.includes(n)
  );
  const far = nodes.filter(
    (n) => n.role !== "target" && n.role !== "payer" && n.role !== "mule" && n.hop > 1 && !mules.includes(n)
  );
  spread(payers, 170, Math.PI * 0.62, Math.PI * 1.38);
  spread(near, 130, -Math.PI * 0.42, Math.PI * 0.42);
  spread(far, 190, -Math.PI * 0.45, Math.PI * 0.45);
  // Place mule chain to the right of target
  mules.forEach((n, i) => {
    pos.set(n.id, { x: CX + 150 + i * 115, y: CY - 20 + (i % 2) * 40 });
  });
  return pos;
}

const short = (id) => (id.length > 16 ? `${id.slice(0, 15)}…` : id);
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function NetworkGraph({ network, onClose }) {
  const mulePath = network?.mulePath || [];
  const muleEdgeKeys = useMemo(
    () => new Set(mulePath.map((h) => `${h.from}->${h.to}`)),
    [mulePath]
  );
  const pos = useMemo(() => (network ? layout(network.nodes, mulePath) : new Map()), [network, mulePath]);
  if (!network) return null;
  const { nodes, edges, summary, graph } = network;

  return (
    <section className="panel stack network-panel" data-testid="network-panel">
      <div className="ml-head">
        <div>
          <span className="eyebrow">Investigate Network · money-mule view</span>
          <h3 style={{ margin: 0 }}>{network.accountId}</h3>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>

      <div className="chip-row">
        <span className="chip">Graph risk {graph.score}/100</span>
        <span className="chip">{summary.accounts} accounts shown</span>
        <span className="chip chip-bad">{summary.blocked} blocked</span>
        <span className="chip">{summary.payers} recent payers</span>
        <span className="chip">{summary.victimsReported} reported this account</span>
        {summary.muleHops > 0 && (
          <span className="chip chip-bad" data-testid="mule-hops">
            {summary.muleHops} mule hop{summary.muleHops === 1 ? "" : "s"} · {inr(summary.muleAmount)} forwarded
          </span>
        )}
      </div>

      {mulePath.length > 0 && (
        <div className="mule-path-banner" data-testid="mule-path">
          <strong>Fund-forward path</strong>
          <ol className="mule-hops">
            {mulePath.map((h) => (
              <li key={`${h.from}-${h.to}`}>
                <code>{short(h.from)}</code> → <code>{short(h.to)}</code>
                <span className="muted"> · hop {h.hop} · {inr(h.amount)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="net-svg" role="img" aria-label="Account network with mule path">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="net-arrow" />
          </marker>
          <marker id="arrow-mule" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#dc2626" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = pos.get(e.source);
          const b = pos.get(e.target);
          if (!a || !b) return null;
          const isMule = e.type === "fund_forward" || muleEdgeKeys.has(`${e.source}->${e.target}`);
          const incident = e.source === network.accountId || e.target === network.accountId;
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={`net-edge net-edge-${e.type}${isMule ? " net-edge-mule" : incident ? "" : " net-edge-faint"}`}
                markerEnd={e.type === "payment" || isMule ? (isMule ? "url(#arrow-mule)" : "url(#arrow)") : undefined}
                strokeWidth={isMule ? 3.5 : undefined}
              />
              {isMule && e.weight > 0 && (
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 6}
                  textAnchor="middle"
                  className="net-amount"
                >
                  {inr(e.weight)}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          const cls =
            n.role === "target"
              ? "target"
              : n.role === "mule"
                ? "mule"
                : n.blocked
                  ? "blocked"
                  : n.flagged
                    ? "flagged"
                    : n.role === "payer"
                      ? "payer"
                      : "ring";
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} className={`net-node net-${cls}`}>
              <title>{`${n.id}\nrole: ${n.role}${n.blocked ? " · BLOCKED" : ""}\ncomplaints: ${n.complaints} · in: ${n.payments} · out: ${n.nOut || 0}`}</title>
              <circle r={n.role === "target" ? 20 : n.role === "mule" ? 14 : 12} />
              {n.role === "target" ? (
                <text y="36" textAnchor="middle" className="net-target-label">{short(n.id)}</text>
              ) : (
                <text x={n.role === "payer" ? -17 : 17} y="4" textAnchor={n.role === "payer" ? "end" : "start"}>
                  {short(n.id)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="net-legend small muted">
        <span><i className="dot dot-target" />Recipient</span>
        <span><i className="dot dot-blocked" />Blocked / confirmed scam</span>
        <span><i className="dot dot-mule" />Mule / cash-out hop</span>
        <span><i className="dot dot-ring" />Shares device or IP</span>
        <span><i className="dot dot-payer" />Victim / payer</span>
        <span><i className="line-key mule" />Fund-forward</span>
        <span><i className="line-key" />Payment</span>
      </div>
      {graph.reasons.length > 0 && (
        <ul className="why-list">{graph.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      )}
    </section>
  );
}
