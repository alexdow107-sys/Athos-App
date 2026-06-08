import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { Logo, LogoMark } from "@/src/components/Logo";
import { colors, radius, spacing } from "@/src/theme";

const FEATURES = [
  {
    icon: "barbell" as const,
    title: "Smart workout tracking",
    desc: "Log lifts, supersets, unilaterals, machines and cardio — Athos auto-completes sets as you train.",
  },
  {
    icon: "trending-up" as const,
    title: "Real progress data",
    desc: "Estimated 1RM, weekly volume, plateau detection — built for people who actually lift.",
  },
  {
    icon: "people" as const,
    title: "A community of athletes",
    desc: "Follow real lifters, cheer them on, share workouts. No lifestyle fluff.",
  },
  {
    icon: "sparkles" as const,
    title: "AI insights when you want them",
    desc: "Claude-powered coach tips based on your training notes and recent sessions.",
  },
];

export default function AppTourScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="app-tour-screen">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <LogoMark size={28} />
          <Text style={styles.brand}>Athos</Text>
        </View>

        <Text style={styles.hello}>{user?.display_name?.split(" ")[0] || "Welcome"},</Text>
        <Text style={styles.title}>Welcome to Athos.</Text>
        <Text style={styles.sub}>Train. Track. Triumph. Here’s what you can do.</Text>

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={styles.iconWrap}>
                <Ionicons name={f.icon} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="app-tour-continue-btn"
          onPress={() => router.replace("/auth/premium-pitch")}
          style={styles.cta}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Continue</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 24 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.xl },
  brand: { color: colors.brand, fontWeight: "900", fontSize: 22, letterSpacing: -0.5 },
  hello: { color: colors.textMuted, fontSize: 16, fontWeight: "700" },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", letterSpacing: -0.8, marginTop: 4 },
  sub: { color: colors.textSecondary, fontSize: 15, marginTop: spacing.sm, lineHeight: 22 },
  featureList: { marginTop: spacing.xl, gap: spacing.lg },
  feature: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  featureTitle: { color: colors.text, fontWeight: "800", fontSize: 15, letterSpacing: -0.2 },
  featureDesc: { color: colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 19 },
  footer: {
    padding: spacing.lg, paddingBottom: Platform.OS === "ios" ? 24 : spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg,
  },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brand, paddingVertical: 16, borderRadius: radius.md,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
