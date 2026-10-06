import { simulateOfflineDecision } from "../../../shared/familyOffline.js";

const base = () => String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const LOCAL_KEY = "scam_shield_family_approvals";

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocal(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 40)));
}

const OFFLINE_CONTACTS = [
  { id: "mom", name: "Priya Prasad (Mom)", relation: "Mother", phone: "98XXXX1001" },
  { id: "sis", name: "Ananya (Sister)", relation: "Sister", phone: "98XXXX1002" },
  { id: "bhai", name: "Rahul (Brother)", relation: "Brother", phone: "98XXXX1003" },
];

export async function fetchTrustedContacts() {
  try {
    const res = await fetch(`${base()}/api/family/contacts`);
    if (!res.ok) throw new Error("offline");
    return (await res.json()).contacts;
  } catch {
    return OFFLINE_CONTACTS;
  }
}

export async function requestFamilyApproval(payload) {
  try {
    const res = await fetch(`${base()}/api/family/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { approval: data.approval, mode: "server" };
  } catch {
    const contact = OFFLINE_CONTACTS.find((c) => c.id === payload.contactId) || OFFLINE_CONTACTS[0];
    const approval = {
      id: `local_${Date.now().toString(36)}`,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      contact,
      payerNote: payload.payerNote || "",
      payment: {
        amount: payload.amount,
        payee: payload.payee,
        entity: payload.entity || "",
        risk: payload.risk || "High Risk",
        summary: payload.summary || "",
      },
      decisionNote: "",
      offlineSim: true,
    };
    const list = loadLocal();
    list.unshift(approval);
    saveLocal(list);
    return { approval, mode: "offline" };
  }
}

export async function getFamilyApproval(id) {
  if (String(id).startsWith("local_")) {
    return loadLocal().find((a) => a.id === id) || null;
  }
  try {
    const res = await fetch(`${base()}/api/family/${id}`);
    if (!res.ok) throw new Error("fail");
    return (await res.json()).approval;
  } catch {
    return loadLocal().find((a) => a.id === id) || null;
  }
}

export async function decideFamilyApproval(id, { decision, note } = {}) {
  if (!String(id).startsWith("local_")) {
    try {
      const res = await fetch(`${base()}/api/family/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      if (res.ok) return { approval: (await res.json()).approval, mode: "server" };
    } catch {
      /* offline fallback */
    }
  }
  const list = loadLocal();
  const idx = list.findIndex((a) => a.id === id);
  const baseRec =
    idx >= 0
      ? list[idx]
      : {
          id,
          status: "pending",
          contact: OFFLINE_CONTACTS[0],
          payment: {},
          createdAt: Date.now(),
        };
  const approval = simulateOfflineDecision(baseRec, decision);
  if (note) approval.decisionNote = note;
  if (idx >= 0) list[idx] = approval;
  else list.unshift(approval);
  saveLocal(list);
  return { approval, mode: "offline" };
}

export async function fetchPendingApprovals() {
  try {
    const res = await fetch(`${base()}/api/family/pending`);
    if (!res.ok) throw new Error("fail");
    const data = await res.json();
    return { pending: data.pending || [], recent: data.recent || [], mode: "server" };
  } catch {
    const list = loadLocal();
    return {
      pending: list.filter((a) => a.status === "pending"),
      recent: list.slice(0, 10),
      mode: "offline",
    };
  }
}

/** One-tap offline guardian decision for the payer (demo). */
export async function simulateGuardianOnDevice(approvalId, decision = "declined") {
  return decideFamilyApproval(approvalId, {
    decision,
    note: decision === "approved" ? "Mom called me back — OK" : "Mom: mat bhejo, scam lag raha hai",
  });
}
