import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme";

const COOLDOWN = { high: 15, elevated: 8, normal: 0 };
const FIRST_PAYEE_LOCK = { high: 45, elevated: 25, normal: 0 };

function levelFromRisk(risk) {
  const r = String(risk || "").toLowerCase();
  if (r.includes("high")) return "high";
  if (r.includes("caution")) return "elevated";
  return "normal";
}

export default function ConfirmPayScreen({ navigation, route }) {
  const {
    amount = "₹842",
    payee = "Official biller",
    summary = "",
    warned = false,
    risk = "",
  } = route.params || {};
  const [processing, setProcessing] = useState(false);
  const level = useMemo(() => levelFromRisk(risk || (warned ? "Caution" : "Safe")), [risk, warned]);
  const newPayee = true; // demo: treat as first-time unless family transfer wording
  const timeLock = level !== "normal";
  const seconds = timeLock ? FIRST_PAYEE_LOCK[level] : COOLDOWN[level];
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    if (!seconds) return undefined;
    const id = setInterval(() => setRemaining((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  function onPay() {
    setProcessing(true);
    setTimeout(() => {
      navigation.replace("Success", { amount, payee, summary, warned });
    }, 700);
  }

  const ready = remaining === 0 && !processing;
  const label = remaining > 0 ? `Cooling off · ${remaining}s` : processing ? "Paying..." : "Confirm & Pay";

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Payment Guardian</Text>
      <Text style={styles.title}>Pay now?</Text>
      <Text style={styles.muted}>
        {warned
          ? "Caution case — take a breath before you continue."
          : "Last safety check before money leaves your account."}
      </Text>

      {timeLock ? (
        <View style={styles.lockBox}>
          <Text style={styles.lockTitle}>
            {remaining > 0 ? `Time-lock · ${remaining}s` : "Time-lock complete"}
          </Text>
          <Text style={styles.lockText}>
            {newPayee ? "First-time / elevated-risk payee. " : ""}
            {level === "high"
              ? "High-risk signals — confirm only if you verified the payee."
              : "Elevated caution — cooling-off before confirm."}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Amount</Text>
        <Text style={styles.value}>{amount}</Text>
        <Text style={[styles.label, { marginTop: 10 }]}>Pay to</Text>
        <Text style={styles.value}>{payee}</Text>
        <Text style={[styles.label, { marginTop: 10 }]}>Shield note</Text>
        <Text style={styles.value}>{summary}</Text>
        {risk ? (
          <>
            <Text style={[styles.label, { marginTop: 10 }]}>Message risk</Text>
            <Text style={styles.value}>{risk}</Text>
          </>
        ) : null}
      </View>

      <Pressable
        style={[styles.payBtn, !ready && styles.payBtnDisabled]}
        onPress={onPay}
        disabled={!ready}
      >
        <Text style={styles.payBtnText}>{label}</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 },
  eyebrow: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,186,242,0.15)",
    color: colors.navy,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.navy },
  muted: { color: colors.muted, lineHeight: 20 },
  lockBox: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  lockTitle: { color: "#9a3412", fontWeight: "800", fontSize: 16 },
  lockText: { color: "#9a3412", marginTop: 4, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  value: { color: colors.navy, fontSize: 16, fontWeight: "600", marginTop: 2 },
  payBtn: {
    backgroundColor: colors.safe || "#16a34a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  payBtnDisabled: { opacity: 0.55 },
  payBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  secondaryBtnText: { color: colors.navy, fontWeight: "700" },
});
