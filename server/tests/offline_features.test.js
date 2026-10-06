
import test from "node:test";
import assert from "node:assert/strict";
import { finalizeAnalysis, pickMockByText, SCENARIO_LIST } from "../../shared/offlineEngine.js";
import { buildMessageDualExplain } from "../../shared/dualExplain.js";
import { suggestSafeReplies } from "../../shared/safeReplies.js";

function run(id) {
  const s = SCENARIO_LIST.find((x) => x.id === id);
  assert.ok(s, id);
  return finalizeAnalysis(pickMockByText(s.text), s.text, { source: "mock" });
}

test("README demo path: electricity bill stays Safe", () => {
  const r = run("electricityBill");
  assert.equal(r.risk, "Safe");
  assert.ok(r.score < 35);
  assert.equal(r.playbook, undefined);
});

test("README demo path: emergency UPI stays Caution", () => {
  const r = run("emergencyUpi");
  assert.equal(r.risk, "Caution");
  assert.equal(r.safe_to_proceed, false);
});

test("README demo path: fake KYC is High Risk with playbook", () => {
  const r = run("fakeKyc");
  assert.equal(r.risk, "High Risk");
  assert.ok(r.score >= 70);
  assert.equal(r.playbook?.playbookId, "fake_kyc");
  assert.ok(r.dual?.user?.headline);
  assert.ok(r.dual?.analyst?.verdict);
});

test("coercion coaching message escalates with intervention", () => {
  const text = "Cyber cell calling. Call pe raho, kisi ko mat batana. AnyDesk install karo aur OTP bhejo.";
  const r = finalizeAnalysis(pickMockByText(text), text, { source: "mock" });
  assert.equal(r.risk, "High Risk");
  assert.equal(r.coercion?.coachingSuspected, true);
  assert.ok(r.coercion.interventionHi);
  assert.equal(r.playbook?.playbookId, "digital_arrest");
});

test("dual explain never invents a different verdict", () => {
  const r = run("fakeKyc");
  const dual = buildMessageDualExplain(r);
  assert.equal(dual.analyst.verdict, r.risk);
  assert.equal(dual.user.generatedBy, "template");
});

test("regional Hindi digital-arrest sample is High Risk", () => {
  const r = run("hindiDigitalArrest");
  assert.equal(r.risk, "High Risk");
  assert.ok(["hi", "hinglish"].includes(r.detected_language) || r.detected_language.startsWith("hi"));
  assert.ok(r.coercion?.coachingSuspected || r.playbook?.playbookId === "digital_arrest");
});

test("Tamil and Bengali samples are High Risk", () => {
  const ta = run("tamilCyber");
  const bn = run("bengaliRefund");
  assert.equal(ta.risk, "High Risk");
  assert.equal(bn.risk, "High Risk");
  assert.ok(String(ta.detected_language).startsWith("ta"));
  assert.ok(String(bn.detected_language).startsWith("bn"));
});


test("safe replies only for High Risk and never auto-send", () => {
  const hi = suggestSafeReplies({ risk: "High Risk", playbook: { playbookId: "fake_kyc" } });
  assert.equal(hi.show, true);
  assert.ok(hi.replies.length >= 2);
  assert.equal(hi.helpline.phone, "1930");
  const safe = suggestSafeReplies({ risk: "Safe" });
  assert.equal(safe.show, false);
});
