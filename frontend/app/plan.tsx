import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { LogoMark } from "@/src/components/Logo";
import { colors, radius, spacing } from "@/src/theme";

const GOAL_LABELS: Record<string, string> = {
  strength: "Strength", hypertrophy: "Hypertrophy", weight_loss: "Weight loss",
  endurance: "Endurance", athletic: "Athletic", general: "General",
};

const PREMIUM_BENEFITS = [
  { icon: "sparkles" as const, text: "AI-generated weekly schedule personalized to YOU" },
  { icon: "barbell" as const, text: "Exercise picks matched to your equipment & experience" },
  { icon: "pulse" as const, text: "Volume & rep ranges built for your session length" },
  { icon: "trending-up" as const, text: "Plan adapts to your recent workout notes" },
];

export default function PlanScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user?.is_premium) { setLoading(false); return; }
      try {
        const p = await api<{ plan: any }>("/coach/plan");
        setPlan(p.plan);
      } finally { setLoading(false); }
    })();
  }, [user?.is_premium]);

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const r = await api<{ plan: any }>("/coach/plan", { method: "POST" });
      setPlan(r.plan);
    } catch (e: any) {
      Alert.alert("Couldn't generate plan", e?.message || "Try again");
    } finally { setGenerating(false); }
  };

  const onBuyPremium = async () => {
    setBuying(true);
    try {
      const r = await api<{ checkout_url: string; session_id: string }>("/subscription/checkout", { method: "POST" });
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = r.checkout_url;
        return;
      }
      await WebBrowser.openAuthSessionAsync(
        r.checkout_url,
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/subscription-success`
      );
      try {
        await api(`/subscription/verify?session_id=${r.session_id}`);
        await refresh();
      } catch {}
    } catch (e: any) {
      Alert.alert("Checkout unavailable", e?.message || "Try again later.");
    } finally { setBuying(false); }
  };

  // === PAYWALL ===
  if (!user?.is_premium) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]} testID="plan-paywall">
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Plan</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.heroBlock}>
            <View style={styles.heroIcon}>
              <Ionicons name="lock-closed" size={28} color="#fff" />
            </View>
            <Text style={styles.heroEyebrow}>Athos Premium</Text>
            <Text style={styles.heroTitle}>Your personal AI coach</Text>
            <Text style={styles.heroSub}>
              Training plans are a Premium feature. Tell us about your goals and Athos builds a 7-day plan tailored to YOU.
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>$9.99</Text>
              <Text style={styles.priceSub}>/month · cancel anytime</Text>
            </View>
          </View>

          <View style={styles.benefits}>
            {PREMIUM_BENEFITS.map((b) => (
              <View key={b.text} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={16} color={colors.brand} />
                </View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          <View style={{ padding: spacing.lg, gap: 10 }}>
            <TouchableOpacity
              testID="plan-buy-btn"
              onPress={onBuyPremium}
              disabled={buying}
              style={[styles.buyBtn, buying && { opacity: 0.6 }]}
              activeOpacity={0.85}
            >
              {buying ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="star" size={16} color="#fff" />
                  <Text style={styles.buyText}>Get Athos Premium</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.fineprint}>
              After subscribing, you&apos;ll answer a few questions about your training so we can build the perfect plan.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // === NEEDS QUESTIONNAIRE (premium but hasn't filled it out) ===
  if (!user.plan_preferences) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]} testID="plan-needs-questionnaire">
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Plan</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.qWrap}>
          <View style={styles.qBadge}>
            <LogoMark size={36} tint={colors.brand} />
          </View>
          <Text style={styles.qTitle}>Let&apos;s build your plan.</Text>
          <Text style={styles.qSub}>
            A few quick questions — how often you train, your goals, equipment, and any limitations.
            We&apos;ll generate a plan immediately after.
          </Text>
          <TouchableOpacity
            testID="start-questionnaire-btn"
            onPress={() => router.push("/plan-questionnaire")}
            style={styles.buyBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.buyText}>Start questionnaire</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // === FULL PLAN VIEW ===
  const prefs = user.plan_preferences || {};
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="plan-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Plan</Text>
        <TouchableOpacity
          testID="edit-questionnaire-btn"
          onPress={() => router.push("/plan-questionnaire")}
          style={styles.iconBtn}
        >
          <Ionicons name="create-outline" size={22} color={colors.brand} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <View style={styles.summary}>
          <Text style={styles.section}>Your training profile</Text>
          <View style={styles.goalsRow}>
            <View style={styles.goalTile}>
              <Text style={styles.goalLabel}>FREQUENCY</Text>
              <Text style={styles.goalValue}>{prefs.days_per_week || "—"}× / wk</Text>
            </View>
            <View style={styles.goalTile}>
              <Text style={styles.goalLabel}>DURATION</Text>
              <Text style={styles.goalValue}>{prefs.session_duration_min ? `${prefs.session_duration_min}m` : "—"}</Text>
            </View>
            <View style={styles.goalTile}>
              <Text style={styles.goalLabel}>GOAL</Text>
              <Text style={styles.goalValue}>{GOAL_LABELS[prefs.primary_goal || ""] || "—"}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Button
            testID="generate-plan-btn"
            title={plan?.ai_enriched ? "Regenerate plan" : "Generate AI plan"}
            onPress={onGenerate}
            loading={generating}
            icon={<Ionicons name="sparkles" size={16} color="#fff" />}
          />
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
          </View>
        ) : (
          <Text style={styles.empty}>Tap &quot;Generate AI plan&quot; to build a 7-day training plan based on your answers.</Text>
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

  heroBlock: { backgroundColor: colors.brand, padding: spacing.xl, paddingTop: spacing.xl, alignItems: "center" },
  heroIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  heroEyebrow: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
  heroTitle: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: -0.7, marginTop: 6, textAlign: "center" },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20, maxWidth: 320 },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: spacing.lg },
  price: { color: "#fff", fontSize: 40, fontWeight: "900", letterSpacing: -1.5 },
  priceSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginLeft: 6, fontWeight: "700" },

  benefits: { padding: spacing.lg, gap: spacing.md },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  benefitText: { color: colors.text, fontSize: 14, flex: 1, lineHeight: 20, fontWeight: "600" },

  buyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brand, paddingVertical: 16, borderRadius: radius.md,
  },
  buyText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  fineprint: { color: colors.textMuted, fontSize: 11, textAlign: "center", lineHeight: 16 },

  qWrap: { padding: spacing.xl, alignItems: "center" },
  qBadge: { width: 80, height: 80, borderRadius: 20, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  qTitle: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.6, marginTop: spacing.lg, textAlign: "center" },
  qSub: { color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20, marginBottom: spacing.xl },

  summary: { backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.lg },
  section: { fontSize: 11, fontWeight: "900", color: colors.textMuted, letterSpacing: 1.2, marginBottom: 8, marginTop: spacing.lg, textTransform: "uppercase" },
  goalsRow: { flexDirection: "row", gap: 8 },
  goalTile: { flex: 1, backgroundColor: colors.bg, padding: spacing.md, borderRadius: radius.md },
  goalLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "900", letterSpacing: 1 },
  goalValue: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 4 },
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
  empty: { color: colors.textMuted, padding: spacing.xl, textAlign: "center", fontStyle: "italic" },
});
