// Rule engine: "does this payment violate known fraud patterns?"
// Deterministic, auditable thresholds. Each rule carries a weight (its own risk estimate);
// rules combine as independent evidence: score = 100 * (1 - prod(1 - weight)).

const plural = (n, word) => `${Math.round(n)} ${word}${Math.round(n) === 1 ? "" : "s"}`;

export const RULES = [
  {
    id: "BLOCKED_RECIPIENT",
    label: "Recipient is a confirmed blocked account",
    weight: 1,
    test: (f) => f.recipientBlocked,
    detail: () => "Recipient account is blocked",
  },
  {
    id: "HIGH_VELOCITY",
    label: "Recipient is receiving payments at abnormal speed",
    weight: (f) => (f.payments5m >= 20 ? 0.55 : 0.3),
    test: (f) => f.payments5m >= 10,
    detail: (f) => `Recipient received ${plural(f.payments5m, "payment")} in the last 5 minutes`,
  },
  {
    id: "BURST_LAST_HOUR",
    label: "Burst of payments to a young account",
    weight: 0.2,
    test: (f) => f.payments1h >= 5 && f.recipientAgeDays < 60 && f.payments5m < 10,
    detail: (f) => `${plural(f.payments1h, "payment")} in the last hour to an account ${Math.round(f.recipientAgeDays)} days old`,
  },
  {
    id: "NEW_ACCOUNT_RECIPIENT",
    label: "Recipient account is very new",
    weight: (f) => (f.recipientAgeDays < 1 ? 0.35 : 0.25),
    test: (f) => f.recipientKnown && f.recipientAgeDays < 7,
    detail: (f) => `Account was created ${f.recipientAgeDays < 1 ? "today" : `${Math.round(f.recipientAgeDays)} days ago`}`,
  },
  {
    id: "HIGH_COMPLAINT_RATE",
    label: "Large share of payments to this recipient were reported",
    weight: 0.5,
    test: (f) => f.complaints >= 3 && f.complaintRate >= 0.15,
    detail: (f) => `${Math.round(f.complaintRate * 100)}% of payments were reported (${plural(f.complaints, "complaint")})`,
  },
  {
    id: "MANY_COMPLAINTS",
    label: "Recipient has been reported by many users",
    weight: (f) => (f.complaints >= 10 ? 0.4 : 0.2),
    test: (f) => f.complaints >= 5,
    detail: (f) => `${f.complaints} users reported this recipient`,
  },
  {
    id: "DEVICE_SHARING",
    label: "Recipient device is shared by several accounts",
    weight: (f) => (f.deviceUsers >= 5 ? 0.35 : 0.2),
    test: (f) => f.deviceUsers >= 3,
    detail: (f) => `Same device is associated with ${f.deviceUsers} accounts`,
  },
  {
    id: "RAPID_FUND_MOVEMENT",
    label: "Recipient forwards received money immediately",
    weight: 0.4,
    test: (f) => f.fundTransferVelocity >= 0.7 && f.amount1h >= 1000,
    detail: (f) => `Recipient moved ${Math.round(Math.min(f.fundTransferVelocity, 1) * 100)}% of the last hour's incoming money onward`,
  },
  {
    id: "REPEATED_AMOUNT",
    label: "Many identical payments to the recipient",
    weight: 0.2,
    test: (f) => f.recipientPayments >= 8 && f.sameAmountRatio >= 0.6,
    detail: (f) => `${Math.round(f.sameAmountRatio * 100)}% of recent payments are exactly ₹${f.amount}`,
  },
  {
    id: "AMOUNT_ANOMALY",
    label: "Amount far above the sender's normal behaviour",
    weight: 0.3,
    test: (f) => f.amountZ >= 4,
    detail: (f) => `Amount is ${f.amountZ.toFixed(1)} standard deviations above the sender's norm`,
  },
  {
    id: "LARGE_FIRST_PAYMENT",
    label: "Large first payment to an unfamiliar recipient",
    weight: 0.5,
    test: (f) => f.newRecipient && f.amount >= 10000 && (f.recipientPayments < 10 || f.recipientAgeDays < 30),
    detail: (f) =>
      `First payment of ₹${Math.round(f.amount).toLocaleString("en-IN")} to a recipient with only ${plural(f.recipientPayments, "payment")} of history`,
  },
  {
    id: "NEW_DEVICE_HIGH_VALUE",
    label: "Large payment from an unrecognised device",
    weight: 0.4,
    test: (f) => f.newDevice && f.amount >= 5000,
    detail: () => "Large payment from a device the sender has not used before",
  },
];

export function evaluateRules(facts) {
  const triggered = [];
  let survive = 1;
  for (const rule of RULES) {
    if (!rule.test(facts)) continue;
    const weight = typeof rule.weight === "function" ? rule.weight(facts) : rule.weight;
    triggered.push({ id: rule.id, label: rule.label, weight, detail: rule.detail(facts) });
    survive *= 1 - weight;
  }
  return {
    score: Math.round((1 - survive) * 100),
    triggeredRules: triggered.map((t) => t.id),
    ruleDetails: triggered,
  };
}
