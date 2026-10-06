import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme";

export default function ConfirmPayScreen({ navigation, route }) {
  const { amount = "₹842", payee = "Official biller", summary = "", warned = false } =
    route.params || {};
  const [processing, setProcessing] = useState(false);

  function onPay() {
    setProcessing(true);
    setTimeout(() => {
      navigation.replace("Success", { amount, payee, summary, warned });
    }, 700);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Confirm payment</Text>
      <Text style={styles.title}>Pay now?</Text>
      <Text style={styles.muted}>
        {warned
          ? "Warning: Caution case. Demo Continue Anyway."
          : "Shield Safe mark. Confirm karke success screen dekho."}
      </Text>

      {warned ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Caution flow — pehle verify better hai. Ye sirf demo Continue Anyway hai.
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
      </View>

      <Pressable style={styles.payBtn} onPress={onPay} disabled={processing}>
        <Text style={styles.payBtnText}>{processing ? "Paying..." : "Confirm & Pay"}</Text>
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
  warn: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warnText: { color: "#991b1b" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  label: { fontWeight: "700", color: colors.navy },
  value: { color: colors.text, marginTop: 2 },
  payBtn: {
    backgroundColor: colors.safe,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  payBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: colors.navy, fontWeight: "700" },
});
