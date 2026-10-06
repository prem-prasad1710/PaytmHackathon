/**
 * In-memory family / trusted-contact approval store for the hackathon demo.
 * Not durable across restarts — intentional.
 */

const DEFAULT_CONTACTS = [
  { id: "mom", name: "Priya Prasad (Mom)", relation: "Mother", phone: "98XXXX1001" },
  { id: "sis", name: "Ananya (Sister)", relation: "Sister", phone: "98XXXX1002" },
  { id: "bhai", name: "Rahul (Brother)", relation: "Brother", phone: "98XXXX1003" },
];

const approvals = new Map(); // id -> record
let seq = 1;

function now() {
  return Date.now();
}

export function listTrustedContacts() {
  return DEFAULT_CONTACTS.map((c) => ({ ...c }));
}

export function createApprovalRequest(body = {}) {
  const contactId = String(body.contactId || "mom");
  const contact = DEFAULT_CONTACTS.find((c) => c.id === contactId) || DEFAULT_CONTACTS[0];
  const id = `fam_${seq++}_${now().toString(36)}`;
  const record = {
    id,
    status: "pending", // pending | approved | declined | expired
    createdAt: now(),
    updatedAt: now(),
    contact,
    payerNote: String(body.payerNote || "").slice(0, 280),
    payment: {
      amount: body.amount || "₹0",
      payee: body.payee || "Unknown",
      entity: body.entity || "",
      risk: body.risk || "High Risk",
      summary: body.summary || "",
    },
    decisionNote: "",
    offlineSim: Boolean(body.offlineSim),
  };
  approvals.set(id, record);
  return { ...record };
}

export function getApproval(id) {
  const r = approvals.get(String(id));
  return r ? { ...r, contact: { ...r.contact }, payment: { ...r.payment } } : null;
}

export function decideApproval(id, { decision, note } = {}) {
  const r = approvals.get(String(id));
  if (!r) return { error: "not_found" };
  if (r.status !== "pending") return { error: "already_decided", record: { ...r } };
  const d = String(decision || "").toLowerCase();
  if (d !== "approved" && d !== "declined") return { error: "invalid_decision" };
  r.status = d;
  r.decisionNote = String(note || "").slice(0, 280);
  r.updatedAt = now();
  return { record: { ...r, contact: { ...r.contact }, payment: { ...r.payment } } };
}

export function listPending() {
  return [...approvals.values()]
    .filter((r) => r.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => ({ ...r, contact: { ...r.contact }, payment: { ...r.payment } }));
}

export function listRecent(limit = 20) {
  return [...approvals.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((r) => ({ ...r, contact: { ...r.contact }, payment: { ...r.payment } }));
}

/** Offline / client-side simulator — same shape, no server. */
export function simulateOfflineDecision(record, decision = "declined") {
  const d = decision === "approved" ? "approved" : "declined";
  return {
    ...record,
    status: d,
    updatedAt: now(),
    decisionNote: d === "approved" ? "Offline sim: guardian approved" : "Offline sim: guardian declined — do not pay",
    offlineSim: true,
  };
}

export function _resetForTests() {
  approvals.clear();
  seq = 1;
}
