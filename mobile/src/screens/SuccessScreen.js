import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme";

export default function SuccessScreen({ navigation, route }) {
  const { amount = "₹842", payee = "Official biller", summary = "", warned = false } =
    route.params || {};

  return (
    <View style={styles.container}>
      <View style={styles.successCircle}>
        <Text style={styles.successMark}>✓</Text>
      </View>
      <Text style={styles.title}>Payment Successful</Text>
      <Text style={styles.muted}>Mock demo only — no real money moved.</Text>

      {warned ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Completed via Continue Anyway (Caution). Real app me extra verification hogi.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Amount</Text>
        <Text style={styles.value}>{amount}</Text>
        <Text style={[styles.label, { marginTop: 10 }]}>Paid to</Text>
        <Text style={styles.value}>{payee}</Text>
        <Text style={[styles.label, { marginTop: 10 }]}>Txn ID</Text>
        <Text style={styles.value}>DEMO{Date.now().toString().slice(-8)}</Text>
        <Text style={[styles.label, { marginTop: 10 }]}>Shield note</Text>
        <Text style={styles.value}>{summary}</Text>
      </View>

      <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("Analyze")}>
        <Text style={styles.primaryBtnText}>Check another message</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Home")}>
        <Text style={styles.secondaryBtnText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(22,163,74,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  successMark: { color: colors.safe, fontSize: 34, fontWeight: "800" },
  title: { fontSize: 26, fontWeight: "800", color: colors.navy },
  muted: { color: colors.muted, textAlign: "center" },
  warn: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    width: "100%",
  },
  warnText: { color: "#991b1b" },
  card: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  label: { fontWeight: "700", color: colors.navy },
  value: { color: colors.text, marginTop: 2 },
  primaryBtn: {
    backgroundColor: colors.blue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  primaryBtnText: { color: colors.navy, fontWeight: "800" },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    width: "100%",
  },
  secondaryBtnText: { color: colors.navy, fontWeight: "700" },
});
