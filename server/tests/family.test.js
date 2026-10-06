
import test from "node:test";
import assert from "node:assert/strict";
import {
  createApprovalRequest,
  decideApproval,
  getApproval,
  listTrustedContacts,
  _resetForTests,
} from "../familyApprovals.js";

test("family contacts are available", () => {
  const c = listTrustedContacts();
  assert.ok(c.length >= 2);
});

test("approval request can be approved and declined", () => {
  _resetForTests();
  const a = createApprovalRequest({
    contactId: "mom",
    amount: "₹999",
    payee: "kyc.verify@ibl",
    risk: "High Risk",
  });
  assert.equal(a.status, "pending");
  const declined = decideApproval(a.id, { decision: "declined", note: "scam" });
  assert.equal(declined.record.status, "declined");
  assert.equal(getApproval(a.id).status, "declined");

  const b = createApprovalRequest({ contactId: "sis", amount: "₹100", payee: "friend@upi" });
  const ok = decideApproval(b.id, { decision: "approved" });
  assert.equal(ok.record.status, "approved");
});
