import { EVIDENCE_ITEMS } from "../../utils/reportPack.js";

export default function EvidenceChecklist({ evidence, onChange }) {
  return (
    <div className="evidence-grid">
      {EVIDENCE_ITEMS.map((item) => (
        <label key={item.key}>
          <input
            type="checkbox"
            checked={Boolean(evidence[item.key])}
            onChange={(e) => onChange(item.key, e.target.checked)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}
