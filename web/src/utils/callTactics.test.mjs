import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeUtterance,
  analyzeCall,
  riskLevel,
  combineTacticScore,
} from "./callTactics.js";

describe("analyzeUtterance — tactic detection", () => {
  it("detects AUTHORITY_CLAIM in English", () => {
    const r = analyzeUtterance("I am calling from RBI cyber cell.");
    assert.ok(r.tactics.some((t) => t.id === "AUTHORITY_CLAIM"));
  });

  it("detects AUTHORITY_CLAIM in Hindi", () => {
    const r = analyzeUtterance("मैं सीबीआई से बोल रहा हूँ।");
    assert.ok(r.tactics.some((t) => t.id === "AUTHORITY_CLAIM"));
  });

  it("detects URGENCY in Hinglish", () => {
    const r = analyzeUtterance("Turant karo abhi hi time nahi hai.");
    assert.ok(r.tactics.some((t) => t.id === "URGENCY"));
  });

  it("detects SECRECY in English", () => {
    const r = analyzeUtterance("Don't tell anyone about this call.");
    assert.ok(r.tactics.some((t) => t.id === "SECRECY"));
  });

  it("detects SECRECY in Hindi", () => {
    const r = analyzeUtterance("किसी को मत बताना यह बात।");
    assert.ok(r.tactics.some((t) => t.id === "SECRECY"));
  });

  it("detects OTP_PIN_REQUEST", () => {
    const r = analyzeUtterance("Please share the OTP you just received.");
    assert.ok(r.tactics.some((t) => t.id === "OTP_PIN_REQUEST"));
  });

  it("detects REMOTE_ACCESS_APP", () => {
    const r = analyzeUtterance("Install AnyDesk on your phone now.");
    assert.ok(r.tactics.some((t) => t.id === "REMOTE_ACCESS_APP"));
  });

  it("detects SAFE_ACCOUNT_TRANSFER", () => {
    const r = analyzeUtterance("Transfer all your money to the safe account.");
    assert.ok(r.tactics.some((t) => t.id === "SAFE_ACCOUNT_TRANSFER"));
  });

  it("detects FEE_OR_DEPOSIT", () => {
    const r = analyzeUtterance("Pay a small processing fee to release your refund.");
    assert.ok(r.tactics.some((t) => t.id === "FEE_OR_DEPOSIT"));
  });

  it("detects ARREST_THREAT", () => {
    const r = analyzeUtterance("An arrest warrant has been issued against you.");
    assert.ok(r.tactics.some((t) => t.id === "ARREST_THREAT"));
  });

  it("detects DIGITAL_ARREST", () => {
    const r = analyzeUtterance("This is a digital arrest, stay on the video call.");
    assert.ok(r.tactics.some((t) => t.id === "DIGITAL_ARREST"));
  });

  it("detects KYC_BLOCK_THREAT", () => {
    const r = analyzeUtterance("Your KYC is expired and account will be blocked.");
    assert.ok(r.tactics.some((t) => t.id === "KYC_BLOCK_THREAT"));
  });

  it("detects PRIZE_OR_REFUND", () => {
    const r = analyzeUtterance("Congratulations, you won a lottery prize!");
    assert.ok(r.tactics.some((t) => t.id === "PRIZE_OR_REFUND"));
  });

  it("detects LINK_OR_APP_INSTALL", () => {
    const r = analyzeUtterance("Click this link to download the app.");
    assert.ok(r.tactics.some((t) => t.id === "LINK_OR_APP_INSTALL"));
  });

  it("detects CARD_DETAILS", () => {
    const r = analyzeUtterance("Tell me your card number and CVV.");
    assert.ok(r.tactics.some((t) => t.id === "CARD_DETAILS"));
  });

  it("skips OTP false positive on awareness messages", () => {
    const r = analyzeUtterance("Remember, your bank will never ask for OTP on a call.");
    assert.equal(r.tactics.some((t) => t.id === "OTP_PIN_REQUEST"), false);
  });

  it("returns empty for benign friend chat", () => {
    const r = analyzeUtterance("Hey, are we still meeting for coffee tomorrow?");
    assert.equal(r.tactics.length, 0);
  });
});

describe("analyzeCall", () => {
  it("combines unique tactics without stacking repeats", () => {
    const utterances = [
      "I am from RBI cyber cell.",
      "Share the OTP immediately.",
      "Share the OTP again please.",
      "Don't tell your family.",
    ];
    const r = analyzeCall(utterances);
    const ids = r.tactics.map((t) => t.id);
    assert.ok(ids.includes("AUTHORITY_CLAIM"));
    assert.ok(ids.includes("OTP_PIN_REQUEST"));
    assert.ok(ids.includes("SECRECY"));
    assert.equal(ids.filter((id) => id === "OTP_PIN_REQUEST").length, 1);
    const expected = combineTacticScore(r.tactics.map((t) => t.weight));
    assert.equal(r.score, expected);
  });

  it("keeps benign delivery call low risk", () => {
    const r = analyzeCall([
      "Hello, I am calling from BlueDart delivery.",
      "Your package has arrived. Can you confirm your address?",
      "Someone will be home to receive it?",
      "Thank you, delivery by 5 PM today.",
    ]);
    assert.ok(r.score < 25);
    assert.equal(r.level, "CALM");
  });

  it("flags digital arrest script as high risk", () => {
    const r = analyzeCall([
      "This is CBI cyber cell.",
      "A digital arrest warrant is issued.",
      "Stay on the video call, do not disconnect.",
      "Transfer money to the safe account immediately.",
    ]);
    assert.ok(r.score >= 75);
    assert.equal(r.level, "HANG UP NOW");
  });

  it("builds timeline in order of first appearance", () => {
    const r = analyzeCall([
      "Urgent action needed today only.",
      "I am police officer from cyber cell.",
    ]);
    assert.equal(r.timeline[0].id, "URGENCY");
    assert.equal(r.timeline[1].id, "AUTHORITY_CLAIM");
  });
});

describe("riskLevel", () => {
  it("maps score bands", () => {
    assert.equal(riskLevel(10), "CALM");
    assert.equal(riskLevel(30), "BE CAREFUL");
    assert.equal(riskLevel(60), "LIKELY SCAM");
    assert.equal(riskLevel(80), "HANG UP NOW");
  });
});
