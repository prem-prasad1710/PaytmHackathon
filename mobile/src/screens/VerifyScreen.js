import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme";

const CHECKS = [
  "Saved/old number pe call kiya",
  "Secret family question sahi jawab",
  "UPI ID / name match karta hai",
];

export default function VerifyScreen({ navigation, route }) {
  const { amount = "₹5,000", payee = "Unknown UPI", summary = "" } = route.params || {};
  const [checked, setChecked] = useState([]);

  function toggle(item) {
    setChecked((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  }

  const allDone = checked.length === CHECKS.length;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Verify First</Text>
      <Text style={styles.title}>Identity check</Text>
      <Text style={styles.muted}>
        Caution case: payment se pehle ye checks complete karo.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Paying</Text>
        <Text style={styles.value}>
          {amount} → {payee}
        </Text>
        <Text style={[styles.muted, { marginTop: 8 }]}>{summary}</Text>
      </View>

      {CHECKS.map((item) => {
        const on = checked.includes(item);
        return (
          <Pressable key={item} style={styles.checkRow} onPress={() => toggle(item)}>
            <View style={[styles.box, on && styles.boxOn]}>
              <Text style={styles.boxMark}>{on ? "✓" : ""}</Text>
            </View>
            <Text style={styles.checkText}>{item}</Text>
          </Pressable>
        );
      })}

      <Pressable
        style={[styles.primaryBtn, !allDone && styles.disabled]}
        disabled={!allDone}
        onPress={() =>
          navigation.navigate("ConfirmPay", {
            amount,
            payee,
            summary: "Verify complete. Ab carefully pay karo.",
            warned: false,
          })
        }
      >
        <Text style={styles.primaryBtnText}>Verified — Continue to Pay</Text>
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
  title: { fontSize: 24, fontWeight: "800", color: colors.navy },
  muted: { color: colors.muted, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  label: { fontWeight: "700", color: colors.navy },
  value: { color: colors.text, marginTop: 2 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  boxOn: { backgroundColor: colors.safe, borderColor: colors.safe },
  boxMark: { color: "#fff", fontWeight: "800", fontSize: 12 },
  checkText: { flex: 1, color: colors.text },
  primaryBtn: {
    backgroundColor: colors.safe,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
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
