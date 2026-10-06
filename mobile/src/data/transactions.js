/**
 * Sample transaction history + complaint helpers (demo / hackathon).
 */

export const COMPLAINT_RECIPIENTS = [
  {
    id: "paytm",
    name: "Paytm Customer Care",
    email: "customer@paytm.com",
    channel: "Paytm Support",
  },
  {
    id: "npci",
    name: "NPCI / UPI Dispute Desk",
    email: "contact@npci.org.in",
    channel: "NPCI",
  },
];

export const SAMPLE_TRANSACTIONS = [
  {
    id: "TXN240901001",
    date: "2026-09-28",
    time: "14:22",
    amount: "₹5,000",
    type: "debit",
    status: "SUCCESS",
    payeeName: "Unknown Collect",
    upiId: "fraud.collect@oksbi",
    mobile: "",
    note: "Shop order #4481",
    category: "UPI",
  },
  {
    id: "TXN240901002",
    date: "2026-09-27",
    time: "11:05",
    amount: "₹99",
    type: "debit",
    status: "SUCCESS",
    payeeName: "Lucky Draw Claim",
    upiId: "lottery.win@paytm",
    mobile: "",
    note: "Processing fee",
    category: "UPI",
  },
  {
    id: "TXN240901003",
    date: "2026-09-26",
    time: "19:40",
    amount: "₹12,000",
    type: "debit",
    status: "SUCCESS",
    payeeName: "Refund Help Desk",
    upiId: "refund.help@ybl",
    mobile: "",
    note: "Reverse payment requested",
    category: "UPI",
  },
  {
    id: "TXN240901004",
    date: "2026-09-25",
    time: "09:15",
    amount: "₹842",
    type: "debit",
    status: "SUCCESS",
    payeeName: "State Electricity Board",
    upiId: "",
    mobile: "",
    note: "Electricity bill - thr-22019",
    category: "Bill",
  },
  {
    id: "TXN240901005",
    date: "2026-09-24",
    time: "16:48",
    amount: "₹1,500",
    type: "debit",
    status: "SUCCESS",
    payeeName: "HR Job Desk",
    upiId: "job.hr@ybl",
    mobile: "9876543210",
    note: "Registration fee",
    category: "UPI",
  },
  {
    id: "TXN240901006",
    date: "2026-09-23",
    time: "08:02",
    amount: "₹299",
    type: "debit",
    status: "SUCCESS",
    payeeName: "Jio Prepaid",
    upiId: "",
    mobile: "9876512345",
    note: "Mobile recharge",
    category: "Recharge",
  },
  {
    id: "TXN240901007",
    date: "2026-09-22",
    time: "21:10",
    amount: "₹2,000",
    type: "debit",
    status: "SUCCESS",
    payeeName: "Mum House",
    upiId: "mum.house@oksbi",
    mobile: "",
    note: "Monthly help",
    category: "Family",
  },
  {
    id: "TXN240901008",
    date: "2026-09-21",
    time: "13:33",
    amount: "₹460",
    type: "debit",
    status: "SUCCESS",
    payeeName: "Rahul Sharma",
    upiId: "rahul.sharma@oksbi",
    mobile: "",
    note: "Dinner split",
    category: "P2P",
  },
];

export function buildComplaintPayload(txn, recipient) {
  const complaintId = `CMP${Date.now().toString().slice(-10)}`;
  const subject = `UPI/Payment dispute — ${txn.id}`;
  const body = [
    "Dear Team,",
    "",
    "I want to raise a complaint against the following transaction.",
    "All details below are auto-filled from my Paytm Scam Shield transaction history.",
    "",
    `Complaint ID: ${complaintId}`,
    `Transaction ID: ${txn.id}`,
    `Date/Time: ${txn.date} ${txn.time}`,
    `Amount: ${txn.amount}`,
    `Status: ${txn.status}`,
    `Category: ${txn.category}`,
    `Payee Name: ${txn.payeeName}`,
    `UPI ID: ${txn.upiId || "N/A"}`,
    `Mobile: ${txn.mobile || "N/A"}`,
    `Note: ${txn.note || "N/A"}`,
    "",
    "Please investigate and take necessary action.",
    "",
    "Regards,",
    "Paytm User (Demo)",
  ].join("\n");

  return {
    complaintId,
    recipient,
    subject,
    body,
    txn,
    sentAt: new Date().toISOString(),
    demoOnly: true,
  };
}

export function buildMailto(payload) {
  const to = encodeURIComponent(payload.recipient.email);
  const subject = encodeURIComponent(payload.subject);
  const body = encodeURIComponent(payload.body);
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
