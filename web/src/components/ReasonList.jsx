export default function ReasonList({ reasons = [], redFlags = [] }) {
  return (
    <div>
      <strong>Why this score</strong>
      <ul className="reason-list">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {redFlags.length > 0 && (
        <>
          <strong style={{ display: "inline-block", marginTop: "0.8rem" }}>Red flags</strong>
          <ul className="flag-list">
            {redFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
