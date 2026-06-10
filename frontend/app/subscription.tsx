import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";

const FEATURES = [
  { icon: "trending-up", title: "Plateau Detection", desc: "Know exactly when a lift stops progressing" },
  { icon: "stats-chart", title: "1RM Trends", desc: "Estimated one-rep max tracking over time" },
  { icon: "git-compare", title: "Imbalance Analysis", desc: "Spot left/right strength gaps" },
  { icon: "sparkles", title: "AI Coach", desc: "Personalized insights from Claude AI" },
  { icon: "calendar", title: "Volume Analytics", desc: "Weekly & monthly volume by muscle group" },
  { icon: "trophy", title: "Personal Record Trends", desc: "See your PR progression visually" },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => { refresh(); }, []);

  const onSubscribe = async () => {
    setLoading(true);
    try {
      const r = await api<{ checkout_url: string; session_id: string }>("/subscription/checkout", { method: "POST" });
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = r.checkout_url;
      } else {
        const res = await WebBrowser.openAuthSessionAsync(r.checkout_url, `${process.env.EXPO_PUBLIC_BACKEND_URL}/subscription-success`);
        // After browser closes, verify
        try {
          await api(`/subscription/verify?session_id=${r.session_id}`);
          await refresh();
        } catch {}
      }
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally { setLoading(false); }
  };

  const onCancel = async () => {
    Alert.alert("Cancel subscription?", "You will lose access to AI insights and premium analytics.", [
      { text: "Keep", style: "cancel" },
      { text: "Cancel", style: "destructive", onPress: async () => {
        setCanceling(true);
        try {
          await api("/subscription/cancel", { method: "POST" });
          await refresh();
        } finally { setCanceling(false); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="subscription-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="star" size={32} color={colors.pr} />
          </View>
          <Text style={styles.title}>Athos Premium</Text>
          <Text style={styles.subtitle}>Train smarter with advanced analytics</Text>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>MONTHLY</Text>
              <View style={styles.priceMain}>
                <Text style={styles.priceDollar}>$</Text>
                <Text style={styles.priceAmount}>9.99</Text>
                <Text style={styles.priceMonth}>/month</Text>
              </View>
            </View>
            {user?.is_premium ? (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.section}>What you get</Text>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon as any} size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}

        <View style={{ marginTop: spacing.xl }}>
          {user?.is_premium ? (
            <Button
              testID="cancel-subscription-btn"
              title="Cancel subscription"
              variant="ghost"
              onPress={onCancel}
              loading={canceling}
            />
          ) : (
            <Button
              testID="subscribe-btn"
              title="Subscribe — $9.99/month"
              onPress={onSubscribe}
              loading={loading}
            />
          )}
        </View>

        <Text style={styles.disclaimer}>
          Cancel anytime. Core workout tracking, social features, exercise tracking, and profile remain free forever.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", padding: spacing.sm },
  iconBtn: { padding: 6 },
  hero: { alignItems: "center", marginBottom: spacing.xl },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(200,154,58,0.15)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "900", color: colors.text, marginTop: spacing.md, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginTop: 4, textAlign: "center" },
  priceCard: { backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, borderRadius: radius.xl, marginBottom: spacing.xl },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  priceMain: { flexDirection: "row", alignItems: "flex-end", marginTop: 4 },
  priceDollar: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  priceAmount: { color: "#fff", fontSize: 48, fontWeight: "900", letterSpacing: -1 },
  priceMonth: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "700", marginBottom: 10, marginLeft: 4 },
  activeBadge: { backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  activeBadgeText: { color: "#fff", fontWeight: "900", fontSize: 11, letterSpacing: 0.5 },
  section: { fontSize: 11, fontWeight: "900", color: colors.textMuted, letterSpacing: 1.2, marginBottom: spacing.md, textTransform: "uppercase" },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  featureIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  featureTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  featureDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  disclaimer: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.lg, lineHeight: 16 },
});
