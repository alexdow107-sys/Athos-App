import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { LogoMark } from "@/src/components/Logo";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";

const { width } = Dimensions.get("window");
const W = Math.min(width, 700);

const SLIDES = [
  {
    icon: "barbell",
    title: "Track every rep.",
    body: "Log your lifts in seconds. Sets, reps, weight, and unilateral L/R tracking — built for the gym floor.",
    img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=900&q=70",
  },
  {
    icon: "trending-up",
    title: "See your progress.",
    body: "Estimated 1RM, weekly volume, muscle distribution, and plateau detection — turn data into PRs.",
    img: "https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=900&q=70",
  },
  {
    icon: "people",
    title: "Train with athletes.",
    body: "Follow lifters, share workouts, and copy programs that work. No lifestyle noise — just the work.",
    img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&q=70",
  },
  {
    icon: "sparkles",
    title: "AI coach in your pocket.",
    body: "Premium users get personalized weekly plans and live coaching tips powered by Claude — built on Athos coaching rules.",
    img: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=900&q=70",
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onNext = () => {
    if (idx < SLIDES.length - 1) {
      const next = idx + 1;
      setIdx(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      router.replace("/auth/onboarding");
    }
  };

  const onSkip = () => router.replace("/auth/onboarding");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="intro-screen">
      <View style={styles.topBar}>
        <LogoMark size={28} tint={colors.brand} />
        <TouchableOpacity testID="intro-skip-btn" onPress={onSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: W }]}>
            <View style={styles.imgWrap}>
              <Image source={{ uri: item.img }} style={styles.image} />
              <View style={styles.imgOverlay} />
              <View style={styles.iconBubble}>
                <Ionicons name={item.icon as any} size={28} color="#fff" />
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
        <Button
          testID="intro-next-btn"
          title={idx < SLIDES.length - 1 ? "Next" : "Let's go"}
          onPress={onNext}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md },
  skipBtn: { padding: 6 },
  skipText: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
  slide: { padding: spacing.lg, alignItems: "center" },
  imgWrap: { width: "100%", height: 360, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.bg3, marginBottom: spacing.xl },
  image: { width: "100%", height: "100%" },
  imgOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(37, 99, 235, 0.12)" },
  iconBubble: { position: "absolute", top: 16, left: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "900", color: colors.text, letterSpacing: -0.8, textAlign: "center" },
  body: { fontSize: 16, color: colors.textSecondary, marginTop: spacing.md, textAlign: "center", lineHeight: 24, paddingHorizontal: spacing.md },
  bottom: { padding: spacing.lg, paddingBottom: spacing.xl },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg3 },
  dotActive: { backgroundColor: colors.brand, width: 24 },
});
