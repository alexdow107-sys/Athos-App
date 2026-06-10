import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  ActivityIndicator, Dimensions, ScrollView, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    photo: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
    overlay: ["rgba(10,20,60,0.45)", "rgba(10,20,60,0.85)"] as [string, string],
    tag: "TRACK EVERYTHING",
    title: "Every rep.\nEvery set.\nEvery PR.",
    desc: "Log workouts in seconds. Athos tracks weight, reps, volume and estimated 1RM — automatically.",
  },
  {
    photo: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80",
    overlay: ["rgba(5,40,20,0.45)", "rgba(5,40,20,0.85)"] as [string, string],
    tag: "REAL PROGRESS",
    title: "See yourself\nget stronger.",
    desc: "Weekly volume charts, plateau detection, and strength trends that show you exactly how far you've come.",
  },
  {
    photo: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800&q=80",
    overlay: ["rgba(50,10,80,0.45)", "rgba(50,10,80,0.85)"] as [string, string],
    tag: "COMMUNITY",
    title: "Train with\nreal athletes.",
    desc: "Follow lifters, celebrate PRs, share your workouts. A feed built for people who actually show up.",
  },
  {
    photo: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80",
    overlay: ["rgba(60,20,5,0.45)", "rgba(60,20,5,0.85)"] as [string, string],
    tag: "YOUR PLAN",
    title: "A plan built\naround you.",
    desc: "Answer a few questions and get a personalised weekly training split — sets, reps, exercises — instantly.",
  },
];

export default function AppTourScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [slide, setSlide] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isLast = slide === SLIDES.length - 1;
  const firstName = user?.display_name?.split(" ")[0] || "Athlete";

  const goToSlide = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setSlide(index);
  };

  const onNext = () => {
    if (isLast) {
      onFinish();
    } else {
      goToSlide(slide + 1);
    }
  };

  const onFinish = async () => {
    setFinishing(true);
    try {
      await api("/users/me/seen-tour", { method: "POST" });
      await refresh();
    } catch {}
    router.replace("/(tabs)" as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="app-tour-screen">
      {/* Slide pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={styles.slide}>
            {/* Full-bleed photo */}
            <Image source={{ uri: s.photo }} style={styles.photo} resizeMode="cover" />
            {/* Dark overlay gradient */}
            <LinearGradient colors={s.overlay} style={StyleSheet.absoluteFillObject} />

            {/* Top bar */}
            <View style={styles.topBar}>
              <Text style={styles.appName}>ATHOS</Text>
              <TouchableOpacity onPress={onFinish}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            </View>

            {/* Text content pinned to bottom */}
            <View style={styles.textBlock}>
              <Text style={styles.tag}>{s.tag}</Text>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.desc}>{s.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.footer}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goToSlide(i)}>
              <View style={[styles.dot, i === slide && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA button */}
        {isLast ? (
          <TouchableOpacity
            testID="app-tour-continue-btn"
            onPress={onNext}
            disabled={finishing}
            style={[styles.cta, styles.ctaFull, finishing && { opacity: 0.6 }]}
            activeOpacity={0.85}
          >
            {finishing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Let's go, {firstName} →</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.navRow}>
            <TouchableOpacity onPress={onFinish} style={styles.ctaGhost}>
              <Text style={styles.ctaGhostText}>Skip intro</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} style={styles.cta} activeOpacity={0.85}>
              <Text style={styles.ctaText}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F172A" },
  slide: { width, height: "100%", overflow: "hidden" },
  photo: { ...StyleSheet.absoluteFillObject as any, width: "100%", height: "100%" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  appName: { color: "rgba(255,255,255,0.9)", fontWeight: "900", fontSize: 14, letterSpacing: 3 },
  skipText: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "600" },
  textBlock: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl,
  },
  tag: {
    color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "800",
    letterSpacing: 2.5, marginBottom: spacing.sm,
  },
  title: {
    color: "#fff", fontSize: 38, fontWeight: "900",
    letterSpacing: -1, lineHeight: 44, marginBottom: spacing.md,
  },
  desc: { color: "rgba(255,255,255,0.75)", fontSize: 15, lineHeight: 23 },
  footer: {
    backgroundColor: "#0F172A", paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === "ios" ? spacing.lg : spacing.md,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" },
  dotActive: { backgroundColor: colors.brand, width: 24 },
  navRow: { flexDirection: "row", gap: 12 },
  cta: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brand, paddingVertical: 16, borderRadius: radius.md,
  },
  ctaFull: { flex: undefined, width: "100%" },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  ctaGhost: {
    flex: 1, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    paddingVertical: 16, borderRadius: radius.md,
  },
  ctaGhostText: { color: "rgba(255,255,255,0.5)", fontWeight: "700", fontSize: 15 },
});
