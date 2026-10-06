import { useEffect, useState } from "react";

const KEYS = {
  checks: "ss_checks",
  reports: "ss_reports",
  payments: "ss_payments",
  settings: "ss_settings",
};
const EVENT = "ss-store";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / disabled */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useStoreValue(getter) {
  const [value, setValue] = useState(getter);
  useEffect(() => {
    const update = () => setValue(getter());
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [getter]);
  return value;
}

export const getChecks = () => read(KEYS.checks, []);
export const getLocalReports = () => read(KEYS.reports, []);
export const getPayments = () => read(KEYS.payments, []);
export const getSettings = () => ({ theme: "light", homeState: "", ...read(KEYS.settings, {}) });

export function setSettings(patch) {
  write(KEYS.settings, { ...getSettings(), ...patch });
}

export function addCheck({ kind, input, result }) {
  const entry = {
    id: `c_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    kind,
    input: String(input || "").slice(0, 280),
    risk: result.risk,
    score: result.score,
    summary: result.hindi_summary,
    amount: result.payment?.amount,
    source: result.source,
  };
  write(KEYS.checks, [entry, ...getChecks()].slice(0, 100));
  return entry;
}

export function clearChecks() {
  write(KEYS.checks, []);
}

export function addLocalReport(report) {
  write(KEYS.reports, [{ ...report, at: new Date().toISOString() }, ...getLocalReports()].slice(0, 200));
}

export function addPayment({ amount, payee, risk }) {
  write(
    KEYS.payments,
    [{ amount: Number(amount) || 0, payee, risk, at: new Date().toISOString() }, ...getPayments()].slice(0, 100)
  );
}

export function parseAmount(value) {
  if (typeof value === "number") return value;
  const m = String(value || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

export function computeSafetyStats(checks = getChecks(), reports = getLocalReports(), payments = getPayments()) {
  const blocked = checks.filter((c) => c.risk === "High Risk");
  const caution = checks.filter((c) => c.risk === "Caution");
  const protectedAmount = blocked.reduce((n, c) => n + parseAmount(c.amount), 0);
  const riskyPayments = payments.filter((p) => p.risk === "High Risk").length;
  const raw = 60 + Math.min(checks.length, 10) * 3 + Math.min(blocked.length, 5) * 4 + Math.min(reports.length, 4) * 5 - riskyPayments * 15;
  return {
    checks: checks.length,
    blocked: blocked.length,
    caution: caution.length,
    reports: reports.length,
    protectedAmount,
    score: Math.max(0, Math.min(100, raw)),
  };
}
