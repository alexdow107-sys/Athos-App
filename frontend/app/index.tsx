import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from "react-native";
import { useRouter, useRootNavigationState, Link } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (loading) return;
    if (!navState?.key) return;
    const target = !user
      ? "/auth/login"
      : !user.onboarded
      ? "/auth/intro"
      : !user.seen_welcome_tour
      ? "/auth/intro"
      : "/(tabs)";
    router.replace(target as any);
  }, [user, loading, navState?.key, router]);

  // Web fallback: hard-redirect if expo-router didn't navigate within 1.2s
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (loading) return;
    const t = setTimeout(() => {
      if (window.location.pathname === "/" || window.location.pathname === "") {
        const target = !user ? "/auth/login" : (!user.onboarded || !user.seen_welcome_tour) ? "/auth/intro" : "/feed";
        window.location.replace(target);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Athos</Text>
      <Text style={styles.tagline}>Train. Track. Triumph.</Text>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.btnWrap}>
          <Link href="/auth/login" asChild>
            <TouchableOpacity testID="splash-login-btn" style={styles.btn}>
              <Text style={styles.btnText}>Get Started</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/auth/signup" asChild>
            <TouchableOpacity testID="splash-signup-btn" style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Create account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: 24 },
  logo: { fontSize: 56, fontWeight: "900", color: colors.brand, letterSpacing: -2 },
  tagline: { fontSize: 14, color: colors.textMuted, marginTop: 4, fontWeight: "600" },
  btnWrap: { marginTop: 40, width: "100%", maxWidth: 360, gap: 8 },
  btn: { backgroundColor: colors.brand, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  btnGhostText: { color: colors.text, fontWeight: "700", fontSize: 14 },
});
