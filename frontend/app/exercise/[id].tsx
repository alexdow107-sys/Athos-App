import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, h] = await Promise.all([
        api<any>(`/analytics/exercise/${id}`),
        api<any>(`/exercises/${id}/history`),
      ]);
      setData(d);
      setHistory(h);
    } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.brand} style={{ marginTop: 64 }} /></SafeAreaView>;
  }

  const points = data?.points || [];
  const max1rm = Math.max(1, ...points.map((p: any) => p.best_1rm));
  const sessions = history?.sessions || [];
  const wu = user?.weight_unit || "kg";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="exercise-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exercise</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.statRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>EST 1RM</Text>
            <Text style={styles.statValue}>{Math.round(data?.last_1rm || 0)}</Text>
            <Text style={styles.statUnit}>{wu}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>TREND</Text>
            <Text style={[styles.statValue, { color: data?.trend_pct >= 0 ? colors.success : colors.danger }]}>
              {data?.trend_pct >= 0 ? "+" : ""}{data?.trend_pct || 0}%
            </Text>
            <Text style={styles.statUnit}>12 weeks</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>SESSIONS</Text>
            <Text style={styles.statValue}>{points.length}</Text>
            <Text style={styles.statUnit}>total</Text>
          </View>
        </View>

        {data?.plateau_sessions > 0 && (
          <View style={styles.plateauCard}>
            <Ionicons name="warning" size={20} color={colors.warning} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.plateauTitle}>Plateau detected</Text>
              <Text style={styles.plateauText}>Your 1RM has stalled for {data.plateau_sessions} session{data.plateau_sessions !== 1 ? "s" : ""}. Consider varying intensity or volume.</Text>
            </View>
          </View>
        )}

        {data?.imbalance_pct != null && data.imbalance_pct > 5 && (
          <View style={styles.imbalanceCard}>
            <Ionicons name="git-compare" size={20} color={colors.danger} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.imbalanceTitle}>Side imbalance: {data.imbalance_pct}%</Text>
              <Text style={styles.imbalanceText}>One side is producing significantly more volume. Focus on the weaker side.</Text>
            </View>
          </View>
        )}

        <Text style={styles.section}>1RM Trend (Estimated)</Text>
        {points.length === 0 ? (
          <Text style={styles.noData}>Log this exercise to see your trend</Text>
        ) : (
          <View style={styles.chartBox}>
            {points.slice(-12).map((p: any, i: number) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barVal}>{Math.round(p.best_1rm)}</Text>
                <View style={[styles.bar, { height: Math.max(6, (p.best_1rm / max1rm) * 120) }]} />
              </View>
            ))}
          </View>
        )}

        <Text style={styles.section}>Recent Sessions</Text>
        {sessions.length === 0 ? (
          <Text style={styles.noData}>No sessions yet</Text>
        ) : (
          sessions.slice(0, 20).map((s: any, i: number) => (
            <View key={i} style={styles.sessionRow}>
              <Text style={styles.sessionDate}>{new Date(s.date).toLocaleDateString()}</Text>
              <Text style={styles.sessionSets}>
                {s.sets.map((st: any, idx: number) =>
                  st.left_weight != null
                    ? `L${st.left_weight}×${st.left_reps} R${st.right_weight}×${st.right_reps}`
                    : `${st.weight}×${st.reps}`
                ).join(" · ")}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  statRow: { flexDirection: "row", padding: spacing.md, gap: 8 },
  statTile: { flex: 1, backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.lg, alignItems: "center" },
  statLabel: { fontSize: 9, fontWeight: "900", color: colors.textMuted, letterSpacing: 1 },
  statValue: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 4 },
  statUnit: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  plateauCard: { flexDirection: "row", margin: spacing.md, padding: spacing.md, backgroundColor: "#FEF3C7", borderRadius: radius.lg, alignItems: "flex-start" },
  plateauTitle: { color: colors.warning, fontWeight: "800" },
  plateauText: { color: colors.text, fontSize: 12, marginTop: 2 },
  imbalanceCard: { flexDirection: "row", margin: spacing.md, padding: spacing.md, backgroundColor: "#FEE2E2", borderRadius: radius.lg, alignItems: "flex-start" },
  imbalanceTitle: { color: colors.danger, fontWeight: "800" },
  imbalanceText: { color: colors.text, fontSize: 12, marginTop: 2 },
  section: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.textMuted, paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase" },
  noData: { color: colors.textMuted, paddingHorizontal: spacing.md, fontStyle: "italic" },
  chartBox: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.md, height: 160, gap: 4 },
  barCol: { flex: 1, alignItems: "center" },
  barVal: { fontSize: 9, color: colors.textMuted, fontWeight: "700" },
  bar: { width: "70%", backgroundColor: colors.brand, borderRadius: 3, marginTop: 2 },
  sessionRow: { paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  sessionDate: { color: colors.text, fontWeight: "700", fontSize: 13 },
  sessionSets: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
});
