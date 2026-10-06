import { getPayments, parseAmount } from "./store";

const TRUSTED_PAYEES = new Set([
  "mum.house@oksbi",
  "rahul.sharma@oksbi",
  "state electricity board",
  "jio prepaid",
  "official biller",
]);

const DEFAULT_AVG = 800;

export function buildTxnContext({ amount, payee, collect = false }) {
  const payments = getPayments();
  const recentAmounts = payments.slice(0, 20).map((p) => p.amount).filter((n) => n > 0);
  const userAvg = recentAmounts.length >= 3
    ? recentAmounts.reduce((a, b) => a + b, 0) / recentAmounts.length
    : DEFAULT_AVG;

  const key = String(payee || "").toLowerCase().trim();
  const knownPayees = new Set([...TRUSTED_PAYEES, ...payments.map((p) => String(p.payee).toLowerCase())]);
  const hourAgo = Date.now() - 3600_000;

  return {
    amount: parseAmount(amount),
    user_avg: Math.round(userAvg),
    new_payee: !knownPayees.has(key),
    hour: new Date().getHours(),
    velocity_1h: payments.filter((p) => new Date(p.at).getTime() > hourAgo).length,
    collect_request: Boolean(collect),
    payee,
  };
}
