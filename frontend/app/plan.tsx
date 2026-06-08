import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";

const GOAL_LABELS: Record<string, string> = {
  strength: "Strength", hypertrophy: "Hypertrophy", calisthenics: "Calisthenics", general: "General fitness",
};
const WEIGHT_LABELS: Record<string, string> = { lose: "Lose weight", maintain: "Maintain", gain: "Gain muscle" };

export default function PlanScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await api<{ plan: any }>("/coach/plan");
        setPlan(p.plan);
      } finally { setLoading(false); }
    })();
  }, []);

  const onGenerate = async () => {
    if (!user?.training_days_per_week) {
      Alert.alert("Set your goals first", "Go to Settings → Training to set your training frequency and main goal.");
      return;
    }
    setGenerating(true);
    try {
      const r = await api<{ plan: any }>("/coach/plan", { method: "POST" });
      setPlan(r.plan);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally { setGenerating(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="plan-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Training Plan</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <View style={styles.summary}>
          <Text style={styles.section}>Your goals</Text>
          <View style={styles.goalsRow}>
            <View style={styles.goalTile}>
              <Text style={styles.goalLabel}>FREQUENCY</Text>
              <Text style={styles.goalValue}>{user?.training_days_per_week || "—"}× / wk</Text>
            </View>
            <View style={styles.goalTile}>
              <Text style={styles.goalLabel}>FOCUS</Text>
              <Text style={styles.goalValue}>{GOAL_LABELS[user?.main_goal || ""] || "—"}</Text>
            </View>
            <View style={styles.goalTile}>
              <Text style={styles.goalLabel}>WEIGHT</Text>
              <Text style={styles.goalValue}>{WEIGHT_LABELS[user?.weight_goal || ""] || "—"}</Text>
            </View>
          </View>
          <TouchableOpacity testID="edit-goals-btn" onPress={() => router.push("/settings")} style={styles.editGoals}>
            <Ionicons name="create-outline" size={14} color={colors.brand} />
            <Text style={styles.editGoalsText}>Edit goals</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Button
            testID="generate-plan-btn"
            title={plan ? "Regenerate plan" : "Generate plan"}
            onPress={onGenerate}
            loading={generating}
            icon={<Ionicons name="sparkles" size={16} color="#fff" />}
          />
          {!user?.is_premium && (
            <Text style={styles.upsell}>
              💡 Free plan uses Athos coaching templates. <Text onPress={() => router.push("/subscription")} style={{ color: colors.brand, fontWeight: "800" }}>Upgrade to Premium</Text> for AI-personalized weekly plans that learn from your workout notes.
            </Text>
          )}
        </View>

        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} /> : plan ? (
          <View style={{ marginTop: spacing.lg }}>
            {plan.ai_enriched && plan.ai_summary && (
              <View style={styles.aiBox}>
                <View style={styles.aiHeader}>
                  <Ionicons name="sparkles" size={14} color={colors.pr} />
                  <Text style={styles.aiHeaderText}>AI COACH SUMMARY</Text>
                </View>
                <Text style={styles.aiSummary}>{plan.ai_summary}</Text>
              </View>
            )}

            {plan.ai_weekly_plan && plan.ai_weekly_plan.length > 0 ? (
              <View>
                <Text style={styles.section}>Your AI weekly schedule</Text>
                {plan.ai_weekly_plan.map((day: any, i: number) => (
                  <View key={i} style={styles.dayCard} testID={`plan-day-${i}`}>
                    <Text style={styles.dayLabel}>{day.day} · <Text style={styles.dayFocus}>{day.focus}</Text></Text>
                    {(day.exercises || []).map((ex: any, j: number) => (
                      <View key={j} style={styles.exLine}>
                        <Text style={styles.exName}>{ex.name}</Text>
                        <Text style={styles.exDetail}>{ex.sets} × {ex.reps}{ex.note ? ` — ${ex.note}` : ""}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.section}>Athos split templates</Text>
            {(plan.templates || []).map((t: any, i: number) => (
              <View key={i} style={styles.templateCard}>
                <Text style={styles.templateName}>{t.name}</Text>
                <View style={styles.scheduleRow}>
                  {t.schedule.map((d: string, j: number) => (
                    <View key={j} style={[styles.schedDay, d.toLowerCase().includes("rest") && styles.schedRest]}>
                      <Text style={[styles.schedText, d.toLowerCase().includes("rest") && styles.schedRestText]}>
                        {d}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.volumeNote}>{t.volume_note}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>Tap "Generate plan" to build a 7-day training plan based on your goals.</Text>
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
  summary: { backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.lg },
  section: { fontSize: 11, fontWeight: "900", color: colors.textMuted, letterSpacing: 1.2, marginBottom: 8, marginTop: spacing.lg, textTransform: "uppercase" },
  goalsRow: { flexDirection: "row", gap: 8 },
  goalTile: { flex: 1, backgroundColor: colors.bg, padding: spacing.md, borderRadius: radius.md },
  goalLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "900", letterSpacing: 1 },
  goalValue: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 4 },
  editGoals: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 4 },
  editGoalsText: { color: colors.brand, fontWeight: "800", fontSize: 12 },
  upsell: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.md, lineHeight: 17, padding: spacing.md, backgroundColor: colors.brandLight + "60", borderRadius: radius.md },
  aiBox: { backgroundColor: colors.text, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.md },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  aiHeaderText: { color: colors.pr, fontWeight: "900", fontSize: 10, letterSpacing: 1 },
  aiSummary: { color: "#fff", fontSize: 13, lineHeight: 19 },
  dayCard: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: 8 },
  dayLabel: { color: colors.text, fontWeight: "800", fontSize: 14, marginBottom: 6 },
  dayFocus: { color: colors.brand },
  exLine: { paddingVertical: 3 },
  exName: { color: colors.text, fontWeight: "700", fontSize: 13 },
  exDetail: { color: colors.textMuted, fontSize: 12 },
  templateCard: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, borderRadius: radius.lg, marginBottom: 10 },
  templateName: { color: colors.text, fontWeight: "800", fontSize: 15, marginBottom: 8 },
  scheduleRow: { flexDirection: "row", gap: 3, marginBottom: 8 },
  schedDay: { flex: 1, paddingVertical: 6, borderRadius: 4, backgroundColor: colors.brand, alignItems: "center" },
  schedRest: { backgroundColor: colors.bg3 },
  schedText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  schedRestText: { color: colors.textMuted },
  volumeNote: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  empty: { color: colors.textMuted, padding: spacing.xl, textAlign: "center", fontStyle: "italic" },
});
