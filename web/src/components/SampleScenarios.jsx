import { SCENARIO_LIST } from "../services/mockResponses";

export default function SampleScenarios({ onSelect, disabled }) {
  return (
    <div className="stack">
      <strong>Demo samples (offline + complaint cases)</strong>
      <div className="sample-row">
        {SCENARIO_LIST.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className="chip"
            disabled={disabled}
            onClick={() => onSelect(scenario.text)}
          >
            {scenario.label}
          </button>
        ))}
      </div>
    </div>
  );
}
