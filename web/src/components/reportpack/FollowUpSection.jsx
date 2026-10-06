export default function FollowUpSection() {
  return (
    <section className="panel follow-up-panel stack">
      <h2 style={{ margin: 0 }}>What happens next</h2>
      <p className="muted" style={{ margin: 0 }}>
        Guidance only — timelines and outcomes vary. After you report:
      </p>
      <ul className="small" style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
        <li>
          <strong>1930 / cybercrime.gov.in:</strong> You may receive a complaint reference. Keep it safe. Police or cyber cell may contact you for evidence.
        </li>
        <li>
          <strong>Your bank:</strong> Ask for a dispute reference. Check your bank&apos;s policy; RBI guidelines on customer protection for unauthorised electronic transactions generally depend on how quickly you report.
        </li>
        <li>
          <strong>Local police:</strong> You can also visit your nearest police station with the same details and evidence.
        </li>
      </ul>

      <h3 style={{ margin: "1rem 0 0.35rem", fontSize: "1rem" }}>Watch for follow-up scams</h3>
      <p className="muted small" style={{ margin: 0 }}>
        Scammers often pose as &quot;recovery agents&quot;, fake cyber police, or bank officials asking for more money or OTPs to &quot;refund&quot; you. Real authorities and banks will not ask for PINs, OTPs, or upfront fees. If someone calls claiming to help recover funds, hang up and call 1930 or your bank directly using the number on your card or official app.
      </p>
    </section>
  );
}
