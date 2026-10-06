import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { colors } from "../theme";

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Hackathon Demo · Grok</Text>
      <Text style={styles.title}>Paytm Scam Shield</Text>
      <Text style={styles.lead}>
        Payment se pehle ek smart second. Suspicious SMS / UPI paste karo — risk score aur
        Hinglish guidance milengi.
      </Text>

      <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("Analyze")}>
        <Text style={styles.primaryBtnText}>Check before you pay</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("History")}>
        <Text style={styles.secondaryBtnText}>Transaction History</Text>
      </Pressable>

      <View style={styles.grid}>
        {["1. Paste", "2. Score", "3. Act", "4. Complaint"].map((item) => (
          <View key={item} style={styles.card}>
            <Text style={styles.cardTitle}>{item}</Text>
            <Text style={styles.muted}>
              {item.startsWith("1")
                ? "SMS / UPI / chat"
                : item.startsWith("2")
                  ? "Safe · Caution · High Risk"
                  : item.startsWith("3")
                    ? "Verify / Pay / Block"
                    : "History select → Paytm / NPCI"}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.bg, flexGrow: 1 },
  eyebrow: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,186,242,0.15)",
    color: colors.navy,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.navy, marginBottom: 10 },
  lead: { color: colors.muted, lineHeight: 22, marginBottom: 18 },
  primaryBtn: {
    backgroundColor: colors.blue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: colors.navy, fontWeight: "800" },
  secondaryBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 18,
  },
  secondaryBtnText: { color: colors.navy, fontWeight: "800" },
  grid: { gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: { color: colors.navy, fontWeight: "700", marginBottom: 4 },
  muted: { color: colors.muted },
});
