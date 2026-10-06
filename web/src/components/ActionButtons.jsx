import { primaryButtonClass } from "../utils/riskStyles";

export default function ActionButtons({ result, onPrimary, onSecondary }) {
  if (!result) return null;

  const primary = result.suggested_ui?.primary_button || "Continue";
  const secondary = result.suggested_ui?.secondary_button || "Ask more";

  return (
    <div className="row-actions">
      <button className={primaryButtonClass(result.risk)} onClick={onPrimary}>
        {primary}
      </button>
      <button className="btn btn-secondary" onClick={onSecondary}>
        {secondary}
      </button>
    </div>
  );
}
