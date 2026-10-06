import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors } from "../theme";

export default function BlockedScreen({ navigation, route }) {
  const { summary = "Ye payment block kar diya gaya.", reported = false } = route.params || {};

  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Text style={styles.mark}>✕</Text>
      </View>
      <Text style={styles.title}>{reported ? "Scam Reported" : "Payment Blocked"}</Text>
      <Text style={styles.muted}>
        {reported
          ? "Demo report save ho gaya. Real app me safety team ko alert jayega."
          : "High Risk detected. Link/UPI PIN mat use karo."}
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Shield note</Text>
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
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(220,38,38,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  mark: { color: colors.danger, fontSize: 30, fontWeight: "800" },
  title: { fontSize: 26, fontWeight: "800", color: colors.navy },
  muted: { color: colors.muted, textAlign: "center", lineHeight: 20 },
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
