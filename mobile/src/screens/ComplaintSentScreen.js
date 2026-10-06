import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { colors } from "../theme";

export default function ComplaintSentScreen({ navigation, route }) {
  const payload = route.params?.payload;

  if (!payload) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No complaint selected</Text>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("History")}>
          <Text style={styles.primaryBtnText}>Go to History</Text>
        </Pressable>
      </View>
    );
  }

  const { recipient, txn, complaintId, subject, body, sentAt } = payload;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.successCircle}>
        <Text style={styles.successMark}>✓</Text>
      </View>
      <Text style={styles.title}>Complaint Sent</Text>
      <Text style={styles.muted}>
        Demo complaint authorised desk ko bhej di gayi (auto-filled).
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>To</Text>
        <Text style={styles.value}>
          {recipient.name} ({recipient.email})
        </Text>
        <Text style={[styles.label, { marginTop: 10 }]}>Complaint ID</Text>
        <Text style={styles.value}>{complaintId}</Text>
        <Text style={[styles.label, { marginTop: 10 }]}>Sent at</Text>
        <Text style={styles.value}>{new Date(sentAt).toLocaleString()}</Text>
        <Text style={[styles.label, { marginTop: 10 }]}>Subject</Text>
        <Text style={styles.value}>{subject}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Auto-filled transaction</Text>
        <Text style={styles.value}>
          {txn.id} · {txn.amount} → {txn.payeeName}
        </Text>
        <Text style={styles.muted}>
          {txn.date} {txn.time} · {txn.upiId || txn.mobile || "N/A"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Message preview</Text>
        <Text style={styles.preview}>{body}</Text>
      </View>

      <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("History")}>
        <Text style={styles.primaryBtnText}>Back to History</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Home")}>
        <Text style={styles.secondaryBtnText}>Home</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.bg,
    flexGrow: 1,
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
    marginTop: 8,
  },
  successMark: { color: colors.safe, fontSize: 34, fontWeight: "800" },
  title: { fontSize: 24, fontWeight: "800", color: colors.navy, textAlign: "center" },
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
  preview: { color: colors.text, marginTop: 8, lineHeight: 20, fontSize: 13 },
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
