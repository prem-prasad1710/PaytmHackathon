import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { colors } from "../theme";
import {
  SAMPLE_TRANSACTIONS,
  COMPLAINT_RECIPIENTS,
  buildComplaintPayload,
} from "../data/transactions";

export default function HistoryScreen({ navigation }) {
  const [selectedId, setSelectedId] = useState(SAMPLE_TRANSACTIONS[0]?.id || "");
  const selected = useMemo(
    () => SAMPLE_TRANSACTIONS.find((t) => t.id === selectedId) || null,
    [selectedId]
  );

  function raiseComplaint(recipient) {
    if (!selected) return;
    const payload = buildComplaintPayload(selected, recipient);
    navigation.navigate("ComplaintSent", { payload });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Transaction History</Text>
      <Text style={styles.muted}>
        Select a transaction, then tap Raise Complaint. Details auto-fill to Paytm / NPCI
        (demo).
      </Text>

      {SAMPLE_TRANSACTIONS.map((txn) => {
        const active = txn.id === selectedId;
        return (
          <Pressable
            key={txn.id}
            style={[styles.txn, active && styles.txnActive]}
            onPress={() => setSelectedId(txn.id)}
          >
            <View style={styles.row}>
              <Text style={styles.payee}>{txn.payeeName}</Text>
              <Text style={styles.amount}>{txn.amount}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.meta}>
                {txn.date} · {txn.time}
              </Text>
              <Text style={styles.meta}>{txn.category}</Text>
            </View>
            <Text style={styles.meta}>
              {txn.id} · {txn.upiId || txn.mobile || txn.note}
            </Text>
          </Pressable>
        );
      })}

      {selected ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Complaint for selected txn</Text>
          <Text style={styles.payee}>{selected.payeeName}</Text>
          <Text style={styles.meta}>
            {selected.amount} · {selected.id}
          </Text>

          {COMPLAINT_RECIPIENTS.map((r) => (
            <Pressable
              key={r.id}
              style={styles.complaintBtn}
              onPress={() => raiseComplaint(r)}
            >
              <Text style={styles.complaintBtnText}>Raise Complaint → {r.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.bg, flexGrow: 1, gap: 10 },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy },
  muted: { color: colors.muted, lineHeight: 20, marginBottom: 6 },
  txn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  txnActive: {
    borderColor: colors.navy,
    backgroundColor: "#eef6ff",
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  payee: { color: colors.navy, fontWeight: "700", flex: 1 },
  amount: { color: colors.danger, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12 },
  panel: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  panelTitle: { color: colors.navy, fontWeight: "800", fontSize: 16 },
  complaintBtn: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  complaintBtnText: { color: "#fff", fontWeight: "800", textAlign: "center" },
});
