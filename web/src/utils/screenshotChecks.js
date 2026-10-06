/**
 * Heuristics for "payment successful" screenshots, a common fake-proof scam.
 * Returns null when the text does not look like a payment confirmation.
 */
export function analyzePaymentScreenshot(text = "") {
  const t = text.toLowerCase();
  const looksLikePayment =
    /(paid|payment|successful|success|sent to|transferred|debited|money sent)/.test(t) &&
    /(₹|rs\.?|inr|\b\d{2,}\b)/.test(t);
  if (!looksLikePayment) return null;

  const findings = [];
  const utr = text.match(/\b\d{12}\b/);

  if (!utr) {
    findings.push({
      id: "no_utr",
      severity: "medium",
      title: "No 12-digit UPI reference (UTR) found",
      detail: "Real UPI confirmations always show one. Fake or edited screenshots often hide or mangle it.",
    });
  } else {
    findings.push({
      id: "utr_present",
      severity: "info",
      title: `Reference ${utr[0]} found`,
      detail: "A reference number alone proves nothing. Look for the credit in your own bank/Paytm app.",
    });
  }

  if (/(pending|processing|in progress|awaiting)/.test(t)) {
    findings.push({
      id: "pending",
      severity: "medium",
      title: "Status says pending / processing",
      detail: "Scammers screenshot a pending payment and claim it is done. Wait for the credit SMS.",
    });
  }

  if (!/\b\d{1,2}[:.]\d{2}\b/.test(text)) {
    findings.push({
      id: "no_time",
      severity: "low",
      title: "No transaction time visible",
      detail: "Genuine receipts include date and time.",
    });
  }

  findings.push({
    id: "never_trust_screenshot",
    severity: "medium",
    title: "Never hand over goods or services on a screenshot",
    detail: "Open your own bank or Paytm app and confirm the money has actually arrived.",
  });

  return findings;
}
