import test from "node:test";
import assert from "node:assert/strict";
import { detectPlaybook, PLAYBOOKS } from "../../shared/playbook.js";
import { detectCoercion } from "../../shared/coercion.js";
import { getJudgeDemoSteps, JUDGE_DEMO_META } from "../../shared/judgeScript.js";
import { buildPaymentDualExplain } from "../../shared/dualExplain.js";

test("playbooks cover the six India UPI scripts", () => {
  assert.equal(PLAYBOOKS.length, 6);
  const ids = new Set(PLAYBOOKS.map((p) => p.id));
  for (const id of ["fake_kyc", "wrong_transfer", "collect_disguise", "job_task", "digital_arrest", "marketplace"]) {
    assert.ok(ids.has(id), id);
  }
});

test("detectPlaybook finds digital arrest from coaching + AnyDesk message", () => {
  const msg =
    "Cyber cell Inspector. Call pe raho, ghar walon ko mat batana. AnyDesk install karo warna digital arrest.";
  const pb = detectPlaybook(msg, { coercionRemote: true, coercionAuthority: true });
  assert.ok(pb);
  assert.equal(pb.playbookId, "digital_arrest");
  assert.ok(pb.stageIndex >= 1);
  assert.match(pb.youAreHere, /stage \d+ of \d+/i);
});

test("detectCoercion flags screen-share and secrecy", () => {
  const c = detectCoercion("Stay on the call. Don't tell family. Install AnyDesk now.");
  assert.equal(c.detected, true);
  assert.equal(c.coachingSuspected, true);
  assert.ok(c.flags.some((f) => f.id === "screen_share"));
  assert.ok(c.scoreBoost >= 20);
});

test("judge demo script has six offline steps and a BLOCK decision", () => {
  assert.ok(JUDGE_DEMO_META.title);
  const steps = getJudgeDemoSteps();
  assert.ok(steps.length >= 6); assert.ok(steps.some((s) => s.kind === "family"));
  const decisionStep = steps.find((s) => s.kind === "decision");
  assert.equal(decisionStep.decision.decision, "BLOCK");
  const dual = buildPaymentDualExplain(decisionStep.decision);
  assert.ok(dual.user.headline);
  assert.equal(dual.analyst.verdict, "BLOCK");
});
