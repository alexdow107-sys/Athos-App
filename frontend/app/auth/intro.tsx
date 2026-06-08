import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { LogoMark } from "@/src/components/Logo";
import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";

const { width } = Dimensions.get("window");
const W = Math.min(width, 720);

const SECTIONS = [
  {
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=70",
    overlayTitle: "Make every workout count.",
    body: {
      heading: "Tracking made easy",
      text: "Athos makes logging lifts, cardio, and sports effortless. Sets, reps, weight, machine, even left/right side — all in one tap.",
    },
  },
  {
    image: "https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=1200&q=70",
    overlayTitle: "See your progress.",
    body: {
      heading: "Strength data that matters",
      text: "Estimated 1RM trends, weekly volume, plateau detection, and L/R imbalance analysis — built for serious lifters.",
    },
  },
  {
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=70",
    overlayTitle: "Train with athletes.",
    body: {
      heading: "Cheer on your community",
      text: "Athos is about training, not lifestyle. Follow real lifters, comment on workouts, save the ones you want to copy.",
    },
  },
  {
    image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1200&q=70",
    overlayTitle: "Get an AI coach.",
    body: {
      heading: "Personalized weekly plans",
      text: "Premium users get a coach-built weekly split powered by Claude AI — informed by your goals, training notes, and recent sessions.",
    },
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [sectionOffsets, setSectionOffsets] = useState<number[]>([]);

  const finish = async () => {
    try {
      await api("/users/me/seen-tour", { method: "POST" });
      await refresh();
    } catch {}
    if (user && !user.onboarded) router.replace("/auth/onboarding");
    else router.replace("/(tabs)");
  };

  const scrollToSection = (idx: number) => {
    const offset = sectionOffsets[idx];
    if (offset == null) {
      // Fallback for web before measurements
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.scrollBy({ top: 700, behavior: "smooth" });
      }
      return;
    }
    scrollRef.current?.scrollTo({ y: offset, animated: true });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="intro-screen">
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <LogoMark size={22} tint={colors.brand} />
          <Text style={styles.brand}>Athos</Text>
        </View>
        <TouchableOpacity testID="intro-skip-btn" onPress={finish} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome header */}
        <View style={styles.welcomeBlock}>
          <Text style={styles.helloText}>{user?.display_name?.split(" ")[0] || "Welcome"},</Text>
          <Text style={styles.welcomeTitle}>Welcome to Athos.</Text>
          <Text style={styles.welcomeSub}>Here&apos;s what you get with Athos — track lifts, see real progress, and train with serious athletes.</Text>
          <TouchableOpacity
            testID="intro-start-btn"
            onPress={() => scrollToSection(0)}
            style={styles.welcomeBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.welcomeBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>

        {SECTIONS.map((s, i) => {
          const isLast = i === SECTIONS.length - 1;
          return (
            <View
              key={i}
              testID={`intro-section-${i}`}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y;
                setSectionOffsets((prev) => {
                  const next = [...prev];
                  next[i] = y;
                  return next;
                });
              }}
            >
              <View style={[styles.heroWrap, { width: W }]}>
                <Image source={{ uri: s.image }} style={styles.heroImage} />
                <View style={styles.heroOverlay} />
                <View style={styles.heroContent}>
                  <Text style={styles.heroTitle}>{s.overlayTitle}</Text>
                  <TouchableOpacity
                    testID={`intro-cta-${i}`}
                    onPress={() => (isLast ? finish() : scrollToSection(i + 1))}
                    style={styles.heroBtn}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.heroBtnText}>{isLast ? "Enter Athos" : "Continue"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.bodyBlock}>
                <Text style={styles.bodyHeading}>{s.body.heading}</Text>
                <Text style={styles.bodyText}>{s.body.text}</Text>
              </View>
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer}>
          <LogoMark size={28} tint={colors.brand} />
          <Text style={styles.footerBrand}>Athos</Text>
          <Text style={styles.footerText}>Train. Track. Triumph.</Text>
          <TouchableOpacity testID="intro-done-btn" onPress={finish} style={styles.doneBtn} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Enter Athos</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { color: colors.brand, fontWeight: "900", fontSize: 18, letterSpacing: -0.5 },
  skipBtn: { padding: 6 },
  skipText: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },

  // Welcome block
  welcomeBlock: { backgroundColor: colors.brand, padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  helloText: { color: "rgba(255,255,255,0.9)", fontSize: 18, fontWeight: "700" },
  welcomeTitle: { color: "#fff", fontSize: 36, fontWeight: "900", marginTop: 6, letterSpacing: -0.8, lineHeight: 42 },
  welcomeSub: { color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: spacing.md, lineHeight: 22 },
  welcomeBtn: { marginTop: spacing.xl, backgroundColor: "#fff", paddingVertical: 14, paddingHorizontal: 24, borderRadius: 4, alignSelf: "flex-start" },
  welcomeBtnText: { color: colors.brand, fontWeight: "800", fontSize: 14 },

  // Hero section with image
  heroWrap: { height: 420, position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.45)" },
  heroContent: { position: "absolute", left: 0, right: 0, top: spacing.xl, padding: spacing.lg },
  heroTitle: { color: "#fff", fontSize: 32, fontWeight: "900", letterSpacing: -0.6, lineHeight: 38, marginBottom: spacing.lg, maxWidth: "85%" },
  heroBtn: { backgroundColor: colors.brand, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 4, alignSelf: "flex-start" },
  heroBtnText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.3 },

  // Body section
  bodyBlock: { padding: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl, backgroundColor: colors.bg, alignItems: "center" },
  bodyHeading: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: -0.4 },
  bodyText: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.md, textAlign: "center", lineHeight: 21, maxWidth: 480 },

  // Footer
  footer: { padding: spacing.xl, paddingVertical: spacing.xxl, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.divider },
  footerBrand: { color: colors.brand, fontWeight: "900", fontSize: 22, marginTop: 6, letterSpacing: -0.5 },
  footerText: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginTop: 2 },
  doneBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brand, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 4, marginTop: spacing.lg },
  doneBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
