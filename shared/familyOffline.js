export function simulateOfflineDecision(record, decision = "declined") {
  const d = decision === "approved" ? "approved" : "declined";
  return {
    ...record,
    status: d,
    updatedAt: Date.now(),
    decisionNote:
      d === "approved"
        ? "Offline sim: guardian approved after a call"
        : "Offline sim: guardian declined — do not pay",
    offlineSim: true,
  };
}
