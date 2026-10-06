import test from "node:test";
import assert from "node:assert/strict";
import { finalizeAnalysis as sharedFinalize, pickMockByText as sharedPick, SCENARIO_LIST as sharedList } from "../../shared/offlineEngine.js";
import { finalizeAnalysis as mobileFinalize, pickMockByText as mobilePick, SCENARIO_LIST as mobileList } from "../../mobile/src/services/offlineEngine.js";

test("mobile offlineEngine re-exports match shared verdicts for demo scenarios", () => {
  assert.equal(sharedList.length, mobileList.length);
  for (const id of ["electricityBill", "emergencyUpi", "fakeKyc", "hindiDigitalArrest", "tamilCyber"]) {
    const s = sharedList.find((x) => x.id === id);
    assert.ok(s, id);
    const a = sharedFinalize(sharedPick(s.text), s.text, { source: "mock" });
    const b = mobileFinalize(mobilePick(s.text), s.text, { source: "mock" });
    assert.equal(a.risk, b.risk, id);
    assert.equal(a.score, b.score, id);
    assert.equal(a.playbook?.playbookId, b.playbook?.playbookId, id);
  }
});
