import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { colors } from "../theme";
import { SCENARIO_LIST } from "../services/mockResponses";
import { analyzeText } from "../services/analyzeApi";
import {
  extractPaymentMeta,
  resolvePrimaryAction,
  resolveSecondaryAction,
  riskColor,
} from "../utils/paymentFlow";

export default function AnalyzeScreen({ navigation }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onAnalyze() {
    setLoading(true);
    try {
      const data = await analyzeText(text);
      setResult(data);
    } catch (err) {
      Alert.alert("Error", err.message || "Something went wrong");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function paymentParams(extra = {}) {
    const meta = extractPaymentMeta(text, result);
    return {
      amount: meta.amount,
      payee: meta.payee,
      summary: meta.summary,
      ...extra,
    };
  }

  function onPrimary() {
    if (!result) return;
    const action = resolvePrimaryAction(result);
    if (action === "confirm_pay") {
      navigation.navigate("ConfirmPay", paymentParams({ warned: false }));
    } else if (action === "verify") {
      navigation.navigate("Verify", paymentParams());
    } else if (action === "block") {
      navigation.navigate("Blocked", paymentParams({ reported: false }));
    }
  }

  function onSecondary() {
    if (!result) return;
    const action = resolveSecondaryAction(result);
    if (action === "continue_anyway") {
      navigation.navigate("ConfirmPay", {
        ...paymentParams({
          warned: true,
          summary: "Continue Anyway selected after Caution warning.",
        }),
      });
    } else if (action === "report") {
      navigation.navigate("Blocked", {
        ...paymentParams({
          reported: true,
          summary: "Scam report submitted (demo).",
        }),
      });
    } else if (action === "tips") {
      Alert.alert("Shield tip", "Sirf official biller / saved contacts se pay karo.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Check before you pay</Text>
      <Text style={styles.muted}>
        Grok optional — offline responses + complaint alerts always available.
      </Text>

      <View style={styles.chipRow}>
        {SCENARIO_LIST.map((s) => (
          <Pressable
            key={s.id}
            style={styles.chip}
            onPress={() => {
              setText(s.text);
              setResult(null);
            }}
          >
            <Text style={styles.chipText}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        multiline
        value={text}
        onChangeText={setText}
        placeholder="English / Hindi / Hinglish — e.g. lotery, ओटीपी, बिजली बिल"
        placeholderTextColor={colors.muted}
      />

      <Pressable style={styles.primaryBtn} onPress={onAnalyze} disabled={loading}>
        <Text style={styles.primaryBtnText}>
          {loading ? "Checking..." : "Check with Grok Shield"}
        </Text>
      </Pressable>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.muted}>Grok check kar raha hai...</Text>
        </View>
      )}

      {!loading && result && (
        <View style={[styles.riskCard, { borderTopColor: riskColor(result.risk) }]}>
          <View style={styles.riskHead}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <Text style={[styles.badge, { backgroundColor: riskColor(result.risk) }]}>
                  {result.risk}
                </Text>
                <Text
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        result.source === "grok" ? colors.navy : "#64748b",
                    },
                  ]}
                >
                  {result.source === "grok" ? "Live Grok" : "Offline"}
                </Text>
              </View>
              <Text style={styles.cardTitle}>Grok Shield Result</Text>
              <Text style={styles.muted}>{result.hindi_summary}</Text>
              {result.message ? (
                <Text style={[styles.muted, { marginTop: 4 }]}>{result.message}</Text>
              ) : null}
              {result.detected_language ? (
                <Text style={[styles.muted, { marginTop: 4 }]}>
                  Language: {result.detected_language}
                  {result.matched_terms?.length
                    ? ` · Matched: ${result.matched_terms.slice(0, 4).join(", ")}`
                    : ""}
                </Text>
              ) : null}
              {result.complaint_alert?.found ? (
                <View style={styles.complaintBox}>
                  <Text style={styles.complaintTitle}>Community Complaint Alert</Text>
                  <Text style={styles.complaintText}>
                    {result.complaint_alert.message_hi}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.score, { backgroundColor: riskColor(result.risk) }]}>
              <Text style={styles.scoreText}>{result.score}</Text>
            </View>
          </View>

          <Text style={styles.body}>
            <Text style={{ fontWeight: "700" }}>Recommended: </Text>
            {result.recommended_action}
          </Text>

          {result.reasons?.map((r) => (
            <Text key={r} style={styles.bullet}>
              • {r}
            </Text>
          ))}

          <Pressable
            style={[styles.actionBtn, { backgroundColor: riskColor(result.risk) }]}
            onPress={onPrimary}
          >
            <Text style={styles.actionBtnText}>
              {result.suggested_ui?.primary_button || "Continue"}
            </Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={onSecondary}>
            <Text style={styles.secondaryBtnText}>
              {result.suggested_ui?.secondary_button || "More"}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.bg, flexGrow: 1, gap: 12 },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy },
  muted: { color: colors.muted, lineHeight: 20 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#f8fbff",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: colors.navy, fontWeight: "600", fontSize: 12 },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.card,
    textAlignVertical: "top",
    color: colors.text,
  },
  primaryBtn: {
    backgroundColor: colors.blue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.navy, fontWeight: "800" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  riskCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 5,
    padding: 14,
    gap: 8,
  },
  riskHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  badge: {
    alignSelf: "flex-start",
    color: "#fff",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 6,
  },
  cardTitle: { color: colors.navy, fontWeight: "800", fontSize: 18, marginBottom: 4 },
  score: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  body: { color: colors.text, lineHeight: 20 },
  bullet: { color: colors.text, lineHeight: 20 },
  actionBtn: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: colors.navy, fontWeight: "700" },
  complaintBox: {
    marginTop: 8,
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  complaintTitle: { color: "#9a3412", fontWeight: "800", marginBottom: 4 },
  complaintText: { color: "#9a3412", lineHeight: 18 },
});
