import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeInput,
  formatInrAmount,
  formatIstDateTime,
  maskAccountNumber,
  timeSinceIncident,
  validateMissingFields,
  buildComplaintEnglish,
  buildComplaintHindi,
  buildBankDisputeEmail,
  buildScammerDetailsBlock,
  buildReportPack,
  prefillFromCheck,
  prefillFromPayment,
  prefillFromReport,
  prefillFromRouterState,
  mergePrefill,
  listHistoryPickerItems,
  prefillFromPickerItem,
} from "./reportPack.js";

const sample = {
  incidentAt: "2025-10-06T10:00:00.000Z",
  discoveredAt: "2025-10-06T10:30:00.000Z",
  channel: "whatsapp",
  scammerPhone: "9876543210",
  scammerUpi: "fraud@ybl",
  scammerUrl: "",
  amountLost: 15000,
  paymentMode: "upi",
  txnRef: "UTR123456789",
  bank: "Paytm Payments Bank",
  description: "Asked for OTP and UPI PIN.",
  evidence: { chatScreenshots: true, paymentConfirmation: true, utr: true, callerNumberScreenshot: false, bankSms: false },
};

describe("reportPack utilities", () => {
  it("formatInrAmount formats Indian currency", () => {
    assert.equal(formatInrAmount(15000), "₹15,000");
    assert.equal(formatInrAmount(0), "₹0");
    assert.match(formatInrAmount("2500.5"), /₹2,500\.5/);
  });

  it("formatIstDateTime returns IST formatted string", () => {
    const out = formatIstDateTime("2025-10-06T10:00:00.000Z");
    assert.match(out, /2025/);
    assert.match(out, /Oct|10/);
  });

  it("maskAccountNumber masks middle digits", () => {
    assert.equal(maskAccountNumber("1234567890"), "******7890");
    assert.equal(maskAccountNumber("12"), "****");
    assert.equal(maskAccountNumber(""), "");
  });

  it("sanitizeInput strips control chars and limits length", () => {
    assert.equal(sanitizeInput("hello\r\nworld"), "hello\nworld");
    assert.equal(sanitizeInput("a\x00b"), "ab");
    assert.equal(sanitizeInput("x".repeat(600)).length, 500);
    assert.equal(sanitizeInput("a\n\n\n\nb"), "a\n\nb");
  });

  it("timeSinceIncident computes elapsed time", () => {
    const incident = "2025-10-06T10:00:00.000Z";
    const now = new Date("2025-10-06T10:45:00.000Z");
    const t = timeSinceIncident(incident, now);
    assert.equal(t.label, "45 min");
    assert.equal(t.urgent, true);
  });

  it("timeSinceIncident handles hours", () => {
    const t = timeSinceIncident("2025-10-06T08:00:00.000Z", new Date("2025-10-06T11:30:00.000Z"));
    assert.match(t.label, /3 hr/);
  });

  it("validateMissingFields flags critical gaps", () => {
    const missing = validateMissingFields({ channel: "call" });
    assert.ok(missing.some((m) => m.field === "incidentAt" && m.severity === "critical"));
    assert.ok(missing.some((m) => m.field === "scammerId"));
  });

  it("validateMissingFields requires payment fields when amount > 0", () => {
    const missing = validateMissingFields({
      incidentAt: sample.incidentAt,
      channel: "call",
      scammerPhone: "9999999999",
      amountLost: 500,
    });
    assert.ok(missing.some((m) => m.field === "txnRef"));
    assert.ok(missing.some((m) => m.field === "paymentMode"));
  });

  it("buildComplaintEnglish includes key fields", () => {
    const text = buildComplaintEnglish(sample);
    assert.match(text, /9876543210/);
    assert.match(text, /fraud@ybl/);
    assert.match(text, /₹15,000/);
    assert.match(text, /UTR123456789/);
    assert.match(text, /1930/);
  });

  it("buildComplaintHindi includes key fields in Hindi", () => {
    const text = buildComplaintHindi(sample);
    assert.match(text, /साइबर धोखाधड़ी/);
    assert.match(text, /9876543210/);
    assert.match(text, /fraud@ybl/);
    assert.match(text, /₹15,000/);
    assert.match(text, /1930/);
    assert.match(text, /cybercrime\.gov\.in/);
  });

  it("buildBankDisputeEmail returns subject and body", () => {
    const { subject, body } = buildBankDisputeEmail(sample);
    assert.match(subject, /Dispute/);
    assert.match(body, /UTR123456789/);
    assert.match(body, /RBI guidelines/);
  });

  it("buildScammerDetailsBlock lists identifiers", () => {
    const block = buildScammerDetailsBlock(sample);
    assert.match(block, /Phone: 9876543210/);
    assert.match(block, /UPI ID: fraud@ybl/);
  });

  it("buildReportPack aggregates outputs", () => {
    const pack = buildReportPack(sample);
    assert.ok(pack.complaintEnglish);
    assert.ok(pack.complaintHindi);
    assert.ok(pack.bankEmail.body);
    assert.ok(Array.isArray(pack.missingFields));
    assert.ok(pack.timeSince);
  });

  it("prefillFromCheck maps check entry", () => {
    const data = prefillFromCheck({
      at: "2025-10-01T12:00:00.000Z",
      kind: "qr",
      input: "scam@paytm",
      risk: "High Risk",
      summary: "Fake QR",
      amount: 2000,
    });
    assert.equal(data.channel, "qr");
    assert.equal(data.scammerUpi, "scam@paytm");
    assert.equal(data.amountLost, 2000);
  });

  it("prefillFromPayment maps payment", () => {
    const data = prefillFromPayment({ at: "2025-10-01T12:00:00.000Z", payee: "thief@ybl", amount: 500, risk: "High Risk" });
    assert.equal(data.scammerUpi, "thief@ybl");
    assert.equal(data.paymentMode, "upi");
  });

  it("prefillFromReport maps local report", () => {
    const data = prefillFromReport({ at: "2025-10-01T12:00:00.000Z", type: "mobile", entity: "9123456789", category: "OTP fraud", note: "Caller claimed bank" });
    assert.equal(data.scammerPhone, "9123456789");
    assert.equal(data.channel, "call");
  });

  it("prefillFromRouterState maps navigation state", () => {
    const data = prefillFromRouterState({ source: "call", summary: "Fake RBI call", payee: "x@ybl", amount: 1000 });
    assert.equal(data.channel, "call");
    assert.equal(data.scammerUpi, "x@ybl");
    assert.equal(data.amountLost, 1000);
  });

  it("mergePrefill combines sources without overwriting with empty", () => {
    const merged = mergePrefill({ channel: "sms" }, { scammerPhone: "9999999999", channel: "" });
    assert.equal(merged.channel, "sms");
    assert.equal(merged.scammerPhone, "9999999999");
  });

  it("listHistoryPickerItems merges and sorts history", () => {
    const items = listHistoryPickerItems(
      [{ id: "c1", at: "2025-10-02T12:00:00.000Z", input: "test", risk: "Caution", kind: "message" }],
      [{ at: "2025-10-03T12:00:00.000Z", payee: "a@ybl", amount: 100, risk: "High Risk" }],
      []
    );
    assert.equal(items.length, 2);
    assert.equal(items[0].kind, "payment");
  });

  it("prefillFromPickerItem dispatches by kind", () => {
    const item = { kind: "check", source: { at: "2025-10-01T12:00:00.000Z", kind: "message", input: "9876543210", risk: "High Risk" } };
    const data = prefillFromPickerItem(item);
    assert.equal(data.scammerPhone, "9876543210");
  });
});
