import { listHistoryPickerItems } from "../../utils/reportPack.js";
import { riskColor } from "../../utils/riskStyles";

export default function HistoryPicker({ checks, payments, reports, selectedId, onSelect }) {
  const items = listHistoryPickerItems(checks, payments, reports);

  if (items.length === 0) {
    return (
      <p className="muted small" style={{ margin: 0 }}>
        No recent checks on this device. Fill the form manually or run a scan first.
      </p>
    );
  }

  return (
    <div className="history-picker" role="listbox" aria-label="Recent checks to prefill">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={selectedId === item.id}
          className={selectedId === item.id ? "selected" : ""}
          onClick={() => onSelect(item)}
        >
          <span
            className="dot-risk"
            style={{ background: riskColor(item.risk), flexShrink: 0 }}
            aria-hidden="true"
          />
          <span className="grow">
            <span className="small">{item.label}</span>
            <span className="muted small" style={{ display: "block" }}>
              {item.kind} · {new Date(item.at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </span>
          <span className="badge">{item.risk}</span>
        </button>
      ))}
    </div>
  );
}
