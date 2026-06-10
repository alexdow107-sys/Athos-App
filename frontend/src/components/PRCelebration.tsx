import React, { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/src/theme";

const { width: SW } = Dimensions.get("window");
const CONFETTI_COLORS = ["#C89A3A", "#6BC5DE", "#3D7A52", "#E0C079", "#C25A35"];

interface PR {
  exercise_name: string;
  estimated_1rm: number;
}

/** Lightweight falling-confetti burst, drawn behind the card. */
function Confetti() {
  const pieces = useRef(
    Array.from({ length: 26 }).map(() => ({
      x: Math.random() * SW,
      delay: Math.random() * 350,
      drift: (Math.random() - 0.5) * 140,
      spin: Math.random() * 360,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 6,
      anim: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    Animated.stagger(
      18,
      pieces.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 1700 + Math.random() * 900,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 760] });
        const translateX = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin + 360}deg`] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 1.4,
              backgroundColor: p.color,
              borderRadius: 1.5,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

export function PRCelebration({
  visible, prs, weightUnit, onClose,
}: {
  visible: boolean;
  prs: PR[];
  weightUnit: string;
  onClose: () => void;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} testID="pr-celebration">
        <Confetti />
        <Animated.View style={[styles.card, { opacity: fade, transform: [{ scale }] }]}>
          <View style={styles.trophyWrap}>
            <Ionicons name="trophy" size={42} color="#C89A3A" />
          </View>
          <Text style={styles.title}>New Personal Record!</Text>
          <Text style={styles.subtitle}>
            {prs.length === 1 ? "You set a new best this session" : `${prs.length} new bests this session`}
          </Text>

          <View style={styles.prList}>
            {prs.map((p, i) => (
              <View key={i} style={styles.prRow}>
                <Ionicons name="ribbon" size={16} color="#C89A3A" />
                <Text style={styles.prName} numberOfLines={1}>{p.exercise_name}</Text>
                <Text style={styles.prVal}>{Math.round(p.estimated_1rm)} {weightUnit}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            testID="pr-celebration-continue"
            style={styles.btn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center", justifyContent: "center", padding: spacing.xl,
  },
  card: {
    width: "100%", maxWidth: 360, backgroundColor: colors.bg2, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(200,154,58,0.40)",
  },
  trophyWrap: {
    width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(200,154,58,0.14)", borderWidth: 1, borderColor: "rgba(200,154,58,0.40)",
    marginBottom: spacing.md,
  },
  title: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.3, textAlign: "center" },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: "center" },
  prList: { width: "100%", marginTop: spacing.lg, gap: 8 },
  prRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(200,154,58,0.10)", borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 11,
  },
  prName: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 14 },
  prVal: { color: "#E0C079", fontWeight: "900", fontSize: 14 },
  btn: {
    marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.full,
    paddingVertical: 13, width: "100%", alignItems: "center",
  },
  btnText: { color: colors.textInverse, fontWeight: "900", fontSize: 15 },
});
