import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { fmtVolume, fmtDuration } from "@/src/utils/format";

const MUSCLE_LABELS: Record<string, string> = {
  chest: "Chest", back: "Back", legs: "Legs", shoulders: "Shoulders",
  biceps: "Biceps", triceps: "Triceps", glutes: "Glutes", hamstrings: "Hamstrings",
  quads: "Quads", calves: "Calves", core: "Core", cardio: "Cardio",
  traps: "Traps", full_body: "Full Body", other: "Other",
};

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const o = await api<any>("/analytics/overview");
      setOverview(o);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 64 }} />
      </SafeAreaView>
    );
  }

  const weeklyMax = Math.max(1, ...(overview?.weekly_volume || []).map((w: any) => w.volume));
  const muscleMax = Math.max(1, ...(overview?.muscle_volume || []).map((m: any) => m.volume));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="analytics-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Overview tiles */}
        <View style={styles.tileRow}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>WORKOUTS</Text>
            <Text style={styles.tileValue}>{overview?.total_workouts || 0}</Text>
            <Text style={styles.tileMeta}>last 12 weeks</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>TOTAL VOLUME</Text>
            <Text style={styles.tileValue}>{fmtVolume(overview?.total_volume || 0, user?.weight_unit || "kg")}</Text>
            <Text style={styles.tileMeta}>last 12 weeks</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>DURATION</Text>
            <Text style={styles.tileValue}>{fmtDuration(overview?.total_duration_seconds || 0)}</Text>
            <Text style={styles.tileMeta}>last 12 weeks</Text>
          </View>
        </View>

        {/* Weekly volume bar chart */}
        <Text style={styles.section}>Weekly Volume</Text>
        {(overview?.weekly_volume || []).length === 0 ? (
          <Text style={styles.noData}>No data yet</Text>
        ) : (
          <View style={styles.chartBox}>
            {(overview.weekly_volume.slice(-8)).map((w: any) => (
              <View key={w.week} style={styles.barCol}>
                <Text style={styles.barVal}>{Math.round(w.volume / 1000)}k</Text>
                <View style={[styles.bar, { height: Math.max(6, (w.volume / weeklyMax) * 120) }]} />
                <Text style={styles.barLabel}>{w.week.split("-W")[1]}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Muscle distribution */}
        <Text style={styles.section}>Muscle Group Volume</Text>
        {(overview?.muscle_volume || []).length === 0 ? (
          <Text style={styles.noData}>No data yet</Text>
        ) : (
          <View style={styles.muscleBox}>
            {overview.muscle_volume.slice(0, 8).map((m: any) => (
              <View key={m.muscle} style={styles.muscleRow}>
                <Text style={styles.muscleLabel}>{MUSCLE_LABELS[m.muscle] || m.muscle}</Text>
                <View style={styles.muscleBarBg}>
                  <View style={[styles.muscleBarFill, { width: `${(m.volume / muscleMax) * 100}%` as any }]} />
                </View>
                <Text style={styles.muscleVal}>{fmtVolume(m.volume, user?.weight_unit || "kg")}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top exercises */}
        <Text style={styles.section}>Top Exercises</Text>
        {(overview?.top_exercises || []).length === 0 ? (
          <Text style={styles.noData}>No data yet</Text>
        ) : (
          (overview.top_exercises || []).map((e: any) => (
            <TouchableOpacity
              key={e.exercise_id}
              testID={`top-exercise-${e.exercise_id}`}
              style={styles.exerciseRow}
              onPress={() => router.push(`/exercise/${e.exercise_id}`)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{e.exercise_name}</Text>
                <Text style={styles.exMeta}>{e.sessions} session{e.sessions !== 1 ? "s" : ""} · {fmtVolume(e.volume, user?.weight_unit || "kg")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
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
  tileRow: { flexDirection: "row", paddingHorizontal: spacing.md, gap: 8, marginTop: spacing.md },
  tile: { flex: 1, backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.lg },
  tileLabel: { fontSize: 9, fontWeight: "900", color: colors.textMuted, letterSpacing: 1 },
  tileValue: { fontSize: 18, fontWeight: "900", color: colors.text, marginTop: 4 },
  tileMeta: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  section: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: colors.textMuted, paddingHorizontal: spacing.md, marginTop: spacing.xl, marginBottom: spacing.sm, textTransform: "uppercase" },
  noData: { color: colors.textMuted, paddingHorizontal: spacing.md, fontStyle: "italic", fontSize: 13 },
  chartBox: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.md, height: 170, gap: 6 },
  barCol: { flex: 1, alignItems: "center" },
  barVal: { fontSize: 9, color: colors.textMuted, fontWeight: "700" },
  bar: { width: "70%", backgroundColor: colors.brand, borderRadius: 4, marginTop: 2 },
  barLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4, fontWeight: "700" },
  muscleBox: { paddingHorizontal: spacing.md },
  muscleRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  muscleLabel: { width: 90, color: colors.text, fontSize: 12, fontWeight: "700" },
  muscleBarBg: { flex: 1, height: 12, backgroundColor: colors.bg3, borderRadius: 6, overflow: "hidden" },
  muscleBarFill: { height: 12, backgroundColor: colors.brand, borderRadius: 6 },
  muscleVal: { width: 70, textAlign: "right", color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  exerciseRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  exName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  exMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
