import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { LogoMark } from "@/src/components/Logo";
import { colors, radius, spacing } from "@/src/theme";
import { generatePlan, type GeneratedPlan } from "@/src/utils/planGenerator";

const GOAL_LABELS: Record<string, string> = {
  strength: "Build Strength",
  hypertrophy: "Hypertrophy",
  weight_loss: "Lose Weight",
  endurance: "Endurance",
  athletic: "Athletic",
  general: "General Fitness",
};

const EXP_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const EQUIP_LABELS: Record<string, string> = {
  full_gym: "Full gym",
  home_dumbbells: "Home gym",
  bodyweight: "Bodyweight",
};

export default function PlanScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // ── No questionnaire yet ────────────────────────────────────────────────────
  if (!user?.plan_preferences) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]} testID="plan-needs-questionnaire">
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Plan</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyBadge}>
            <LogoMark size={36} tint={colors.brand} />
          </View>
          <Text style={styles.emptyTitle}>Build your plan.</Text>
          <Text style={styles.emptySub}>
            Answer a few quick questions about your training frequency, goals, and equipment.
            We'll build a personalised weekly plan instantly.
          </Text>
          <TouchableOpacity
            testID="start-questionnaire-btn"
            onPress={() => router.push("/plan-questionnaire")}
            style={styles.primaryBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Start questionnaire</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Plan view ───────────────────────────────────────────────────────────────
  return <PlanView prefs={user.plan_preferences} onChangeAnswers={() => router.push("/plan-questionnaire")} onBack={() => router.back()} />;
}

function PlanView({ prefs, onChangeAnswers, onBack }: { prefs: any; onChangeAnswers: () => void; onBack: () => void }) {
  const plan: GeneratedPlan = useMemo(() => generatePlan(prefs), [prefs]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="plan-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={onBack} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Plan</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Training profile ──────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Training profile</Text>
        <View style={styles.profileCard}>
          <Stat label="FREQUENCY" value={prefs.days_per_week ? `${prefs.days_per_week}× / week` : "—"} />
          <Divider />
          <Stat label="SESSION" value={prefs.session_duration_min ? `${prefs.session_duration_min} min` : "—"} />
          <Divider />
          <Stat label="GOAL" value={GOAL_LABELS[prefs.primary_goal] ?? "—"} />
          <Divider />
          <Stat label="LEVEL" value={EXP_LABELS[prefs.experience_level] ?? "—"} />
          <Divider />
          <Stat label="EQUIPMENT" value={EQUIP_LABELS[prefs.equipment] ?? "—"} />
        </View>

        {/* ── Split name ────────────────────────────────────────────────────── */}
        <View style={styles.splitBadge}>
          <Ionicons name="calendar-outline" size={15} color={colors.brand} />
          <Text style={styles.splitName}>{plan.splitName}</Text>
        </View>

        {/* ── Not-recommended notice ────────────────────────────────────────── */}
        {plan.splitNotice ? (
          <View style={styles.warnCard}>
            <Ionicons name="warning-outline" size={15} color="#B45309" style={{ marginTop: 1 }} />
            <Text style={styles.warnText}>{plan.splitNotice}</Text>
          </View>
        ) : null}

        {/* ── Coach note ────────────────────────────────────────────────────── */}
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>{plan.coachNote}</Text>
        </View>

        {/* ── Weekly plan ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Weekly schedule</Text>
        {plan.days.map((day, i) => (
          <View key={i} style={[styles.dayCard, day.isRest && styles.dayCardRest]} testID={`plan-day-${i}`}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{day.day}</Text>
              <Text style={[styles.dayFocus, day.isRest && styles.dayFocusRest]}>{day.focus}</Text>
            </View>
            {!day.isRest && day.exercises.map((ex, j) => (
              <View key={j} style={styles.exRow}>
                <View style={styles.exDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exDetail}>{ex.sets} sets × {ex.reps} reps{ex.note ? ` · ${ex.note}` : ""}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* ── Change answers button ─────────────────────────────────────────── */}
        <TouchableOpacity
          testID="change-answers-btn"
          onPress={onChangeAnswers}
          style={styles.changeBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.brand} />
          <Text style={styles.changeBtnText}>Change my answers</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.statDivider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", padding: spacing.sm,
    justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: 60 },

  // Empty state
  emptyWrap: { flex: 1, padding: spacing.xl, alignItems: "center", justifyContent: "center" },
  emptyBadge: {
    width: 80, height: 80, borderRadius: 20, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  emptyTitle: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.6, textAlign: "center" },
  emptySub: { color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 21, marginBottom: spacing.xl },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brand, paddingVertical: 16, paddingHorizontal: 28, borderRadius: radius.md,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  // Profile card
  sectionLabel: {
    fontSize: 11, fontWeight: "900", color: colors.textMuted,
    letterSpacing: 1.2, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase",
  },
  profileCard: {
    backgroundColor: colors.bg2, borderRadius: radius.lg,
    padding: spacing.md, gap: 0,
  },
  stat: { paddingVertical: 10 },
  statLabel: { fontSize: 10, fontWeight: "900", color: colors.textMuted, letterSpacing: 1.2, textTransform: "uppercase" },
  statValue: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 2 },
  statDivider: { height: 1, backgroundColor: colors.divider },

  // Split badge
  splitBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: spacing.lg, backgroundColor: colors.brandLight,
    paddingVertical: 10, paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  splitName: { color: colors.brand, fontWeight: "800", fontSize: 14 },

  // Coach note
  noteCard: {
    marginTop: spacing.sm, backgroundColor: colors.bg2,
    padding: spacing.md, borderRadius: radius.md,
  },
  noteText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },

  // Day cards
  dayCard: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: 10,
  },
  dayCardRest: { opacity: 0.45 },
  dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  dayName: { color: colors.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  dayFocus: { color: colors.brand, fontSize: 14, fontWeight: "800" },
  dayFocusRest: { color: colors.textMuted },
  exRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 5 },
  exDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 5 },
  exName: { color: colors.text, fontWeight: "700", fontSize: 13 },
  exDetail: { color: colors.textMuted, fontSize: 12, marginTop: 1 },

  // Not-recommended warning
  warnCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: "rgba(200,154,58,0.10)", borderWidth: 1, borderColor: "rgba(200,154,58,0.30)",
  },
  warnText: { color: "#E0C079", fontSize: 12, lineHeight: 17, flex: 1, fontWeight: "600" },

  // Change answers button
  changeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: spacing.xl, paddingVertical: 15, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.brand,
  },
  changeBtnText: { color: colors.brand, fontWeight: "800", fontSize: 14 },
});
