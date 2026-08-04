import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useWorkout } from "@/src/context/WorkoutContext";
import { colors, radius, spacing } from "@/src/theme";
import { fmtDuration } from "@/src/utils/format";

/** Floating pill above the tab bar showing the live workout timer (and rest
 * countdown when resting). Tap to jump back into the active workout. */
export function WorkoutPill() {
  const { active, elapsed, restRemaining, restRunning } = useWorkout();
  const router = useRouter();
  const pathname = usePathname();

  // Hide while already on the active-workout screen.
  if (!active || pathname?.startsWith("/workout/active")) return null;

  const resting = restRunning && restRemaining > 0;

  return (
    <TouchableOpacity
      testID="workout-pill"
      style={styles.pill}
      onPress={() => router.push("/workout/active")}
      activeOpacity={0.9}
    >
      <View style={styles.dot} />
      <Text style={styles.name} numberOfLines={1}>{active.name}</Text>
      <View style={{ flex: 1 }} />
      {resting ? (
        <View style={styles.restChip}>
          <Ionicons name="timer-outline" size={12} color={colors.textInverse} />
          <Text style={styles.restText}>{fmtDuration(restRemaining)}</Text>
        </View>
      ) : null}
      <Text style={styles.time}>{fmtDuration(elapsed)}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textInverse} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    left: spacing.md, right: spacing.md,
    bottom: Platform.OS === "ios" ? 78 : 72,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.brand, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textInverse },
  name: { color: colors.textInverse, fontWeight: "800", fontSize: 14, maxWidth: 140 },
  restChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.22)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full,
  },
  restText: { color: colors.textInverse, fontWeight: "900", fontSize: 12, fontVariant: ["tabular-nums"] },
  time: { color: colors.textInverse, fontWeight: "900", fontSize: 15, fontVariant: ["tabular-nums"] },
});
