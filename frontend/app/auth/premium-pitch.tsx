import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { useAuth } from "@/src/context/AuthContext";
import { LogoMark } from "@/src/components/Logo";
import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

const PERKS = [
  { icon: "trending-up" as const, title: "Plateau detection", desc: "Know exactly when a lift stops progressing." },
  { icon: "stats-chart" as const, title: "1RM trends", desc: "Estimated one-rep max charted over time." },
  { icon: "git-compare" as const, title: "Imbalance analysis", desc: "Spot left/right strength gaps before they cost you." },
  { icon: "sparkles" as const, title: "AI coach", desc: "Personalized weekly insights powered by Claude." },
  { icon: "calendar" as const, title: "Volume analytics", desc: "Weekly & monthly volume by muscle group." },
  { icon: "trophy" as const, title: "PR tracker", desc: "Auto-detected personal records with charts." },
];

export default function PremiumPitchScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [buying, setBuying] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const markTourSeen = async () => {
    try {
      await api("/users/me/seen-tour", { method: "POST" });
      await refresh();
    } catch {}
  };

  const onSkip = async () => {
    setSkipping(true);
    try {
      await markTourSeen();
      router.replace("/(tabs)");
    } finally {
      setSkipping(false);
    }
  };

  const onBuy = async () => {
    setBuying(true);
    try {
      await markTourSeen();
      const r = await api<{ checkout_url: string; session_id: string }>(
        "/subscription/checkout",
        { method: "POST" }
      );
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
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Checkout unavailable", e?.message || "Try again later.");
      router.replace("/(tabs)");
    } finally {
      setBuying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="premium-pitch-screen">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBlock}>
          <View style={styles.brandRow}>
            <LogoMark size={26} tint={"#fff"} />
            <Text style={styles.brand}>Athos Premium</Text>
          </View>
          <Text style={styles.title}>Train smarter.</Text>
          <Text style={styles.sub}>Unlock data-driven coaching that grows with you.</Text>
          <View style={styles.priceWrap}>
            <Text style={styles.price}>$9.99</Text>
            <Text style={styles.priceSub}>per month • cancel anytime</Text>
          </View>
        </View>

        <View style={styles.perkList}>
          {PERKS.map((p) => (
            <View key={p.title} style={styles.perk}>
              <View style={styles.iconWrap}>
                <Ionicons name={p.icon} size={18} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkDesc}>{p.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="premium-pitch-buy-btn"
          onPress={onBuy}
          disabled={buying || skipping}
          style={[styles.buyBtn, (buying || skipping) && { opacity: 0.6 }]}
          activeOpacity={0.85}
        >
          {buying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="star" size={16} color="#fff" />
              <Text style={styles.buyText}>Get Premium</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          testID="premium-pitch-skip-btn"
          onPress={onSkip}
          disabled={buying || skipping}
          style={styles.skipBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>{skipping ? "…" : "Maybe later"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 24 },
  headerBlock: {
    backgroundColor: colors.brand, padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.lg },
  brand: { color: "#fff", fontWeight: "900", fontSize: 18, letterSpacing: -0.3 },
  title: { color: "#fff", fontSize: 38, fontWeight: "900", letterSpacing: -0.8, lineHeight: 42 },
  sub: { color: "rgba(255,255,255,0.9)", fontSize: 15, marginTop: spacing.sm, lineHeight: 22 },
  priceWrap: { flexDirection: "row", alignItems: "baseline", marginTop: spacing.xl },
  price: { color: "#fff", fontSize: 44, fontWeight: "900", letterSpacing: -1.5 },
  priceSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginLeft: 8, fontWeight: "700" },
  perkList: { padding: spacing.lg, gap: spacing.lg },
  perk: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 9, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  perkTitle: { color: colors.text, fontWeight: "800", fontSize: 14, letterSpacing: -0.2 },
  perkDesc: { color: colors.textSecondary, fontSize: 13, marginTop: 3, lineHeight: 19 },
  footer: {
    padding: spacing.lg, paddingBottom: Platform.OS === "ios" ? 24 : spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg, gap: 8,
  },
  buyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brand, paddingVertical: 16, borderRadius: radius.md,
  },
  buyText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  skipBtn: { paddingVertical: 12, alignItems: "center" },
  skipText: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
});
