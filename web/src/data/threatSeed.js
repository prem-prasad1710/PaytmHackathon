export const STATE_TILES = [
  { code: "LA", name: "Ladakh", col: 2, row: 0 },
  { code: "JK", name: "Jammu & Kashmir", col: 3, row: 0 },
  { code: "CH", name: "Chandigarh", col: 1, row: 1 },
  { code: "PB", name: "Punjab", col: 2, row: 1 },
  { code: "HP", name: "Himachal Pradesh", col: 3, row: 1 },
  { code: "UK", name: "Uttarakhand", col: 4, row: 1 },
  { code: "SK", name: "Sikkim", col: 6, row: 1 },
  { code: "AR", name: "Arunachal Pradesh", col: 8, row: 1 },
  { code: "RJ", name: "Rajasthan", col: 1, row: 2 },
  { code: "HR", name: "Haryana", col: 2, row: 2 },
  { code: "DL", name: "Delhi", col: 3, row: 2 },
  { code: "UP", name: "Uttar Pradesh", col: 4, row: 2 },
  { code: "BR", name: "Bihar", col: 5, row: 2 },
  { code: "WB", name: "West Bengal", col: 6, row: 2 },
  { code: "AS", name: "Assam", col: 7, row: 2 },
  { code: "NL", name: "Nagaland", col: 8, row: 2 },
  { code: "GJ", name: "Gujarat", col: 1, row: 3 },
  { code: "MP", name: "Madhya Pradesh", col: 3, row: 3 },
  { code: "CG", name: "Chhattisgarh", col: 4, row: 3 },
  { code: "JH", name: "Jharkhand", col: 5, row: 3 },
  { code: "ML", name: "Meghalaya", col: 7, row: 3 },
  { code: "MN", name: "Manipur", col: 8, row: 3 },
  { code: "MH", name: "Maharashtra", col: 2, row: 4 },
  { code: "TS", name: "Telangana", col: 4, row: 4 },
  { code: "OD", name: "Odisha", col: 5, row: 4 },
  { code: "TR", name: "Tripura", col: 7, row: 4 },
  { code: "MZ", name: "Mizoram", col: 8, row: 4 },
  { code: "GA", name: "Goa", col: 2, row: 5 },
  { code: "KA", name: "Karnataka", col: 3, row: 5 },
  { code: "AP", name: "Andhra Pradesh", col: 4, row: 5 },
  { code: "KL", name: "Kerala", col: 3, row: 6 },
  { code: "TN", name: "Tamil Nadu", col: 4, row: 6 },
  { code: "PY", name: "Puducherry", col: 5, row: 6 },
];

/** Illustrative baseline so the demo map is populated before real reports arrive. */
export const SEED_STATE_COUNTS = {
  DL: 412, MH: 388, KA: 341, UP: 330, TN: 262, TS: 255, WB: 214, GJ: 198, RJ: 187, HR: 176,
  BR: 164, MP: 150, KL: 132, PB: 121, OD: 109, AP: 104, JH: 93, AS: 88, CG: 76, UK: 61,
  HP: 44, GA: 41, CH: 38, JK: 35, PY: 22, TR: 19, ML: 17, MN: 15, SK: 12, AR: 11, NL: 9, MZ: 8, LA: 5,
};

export const SEED_CATEGORIES = [
  { name: "QR / collect-request scam", count: 1840, trend: 34 },
  { name: "KYC / account-block phishing", count: 1620, trend: 12 },
  { name: "OTP / PIN theft", count: 1415, trend: 5 },
  { name: "Police / authority impersonation", count: 960, trend: 41 },
  { name: "Lottery / prize fee scam", count: 740, trend: -6 },
  { name: "Job / task fee scam", count: 690, trend: 19 },
  { name: "Fake family emergency", count: 410, trend: 27 },
];

export const TRENDING_ALERTS = [
  { id: "t1", severity: "high", title: "QR 'receive money' scams up 34% this week", body: "Fake buyers on marketplaces ask you to scan a QR to receive an advance. Scanning only ever sends money." },
  { id: "t2", severity: "high", title: "'Digital arrest' video-call threats", body: "No Indian agency arrests anyone over a video call or asks for money to 'clear' a case. Hang up and call 1930." },
  { id: "t3", severity: "medium", title: "Fake KYC links via SMS and WhatsApp", body: "Paytm never asks for UPI PIN, OTP or card details to complete KYC. Use only the official app." },
  { id: "t4", severity: "medium", title: "Tampered shop QR stickers", body: "Check that the name shown after scanning matches the shop board before you pay." },
];

export const HELPLINES = [
  { name: "National Cyber Crime Helpline", value: "1930", href: "tel:1930" },
  { name: "Report online", value: "cybercrime.gov.in", href: "https://cybercrime.gov.in" },
];

export const REPORT_CATEGORIES = [
  "QR / collect-request scam",
  "KYC / account-block phishing",
  "OTP / PIN theft",
  "Police / authority impersonation",
  "Lottery / prize fee scam",
  "Job / task fee scam",
  "Fake family emergency",
  "Refund / wrong-transfer scam",
  "Marketplace advance scam",
  "Other",
];
