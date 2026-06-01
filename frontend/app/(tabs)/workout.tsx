import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useWorkout } from "@/src/context/WorkoutContext";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";
import { fmtDuration } from "@/src/utils/format";

export default function WorkoutTab() {
  const router = useRouter();
  const { active, elapsed, startWorkout, cancelWorkout } = useWorkout();
  const [starting, setStarting] = useState(false);

  useFocusEffect(useCallback(() => {}, []));

  const onStart = async () => {
    setStarting(true);
    try {
      await startWorkout();
      router.push("/workout/active");
    } catch (e: any) {
      Alert.alert("Failed", e.message || "Could not start workout");
    } finally {
      setStarting(false);
    }
  };

  const onResume = () => router.push("/workout/active");

  const onCancel = async () => {
    Alert.alert("Discard workout?", "This will permanently delete your active workout.", [
      { text: "Cancel", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: async () => { await cancelWorkout(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} testID="workout-tab" edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Workout</Text>
        <Text style={styles.subtitle}>Track every rep. Crush every set.</Text>

        {active ? (
          <View style={styles.activeCard} testID="active-workout-card">
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>WORKOUT IN PROGRESS</Text>
            </View>
            <Text style={styles.activeName}>{active.name}</Text>
            <Text style={styles.activeDuration}>{fmtDuration(elapsed)}</Text>
            <Text style={styles.activeMeta}>{active.exercises.length} exercise{active.exercises.length !== 1 ? "s" : ""}</Text>
            <View style={{ marginTop: spacing.lg, gap: 8 }}>
              <Button testID="resume-workout-button" title="Resume workout" onPress={onResume} />
              <Button testID="discard-workout-button" title="Discard" variant="ghost" onPress={onCancel} />
            </View>
          </View>
        ) : (
          <View style={styles.startCard}>
            <Ionicons name="barbell" size={64} color={colors.brand} />
            <Text style={styles.startTitle}>Start a workout</Text>
            <Text style={styles.startSubtitle}>Log exercises, sets, and PRs in real time</Text>
            <View style={{ marginTop: spacing.xl }}>
              <Button testID="start-workout-button" title="Start Empty Workout" onPress={onStart} loading={starting} />
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            testID="goto-calendar"
            style={styles.actionCard}
            onPress={() => router.push("/calendar")}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={24} color={colors.brand} />
            <Text style={styles.actionTitle}>History</Text>
            <Text style={styles.actionMeta}>Calendar & past workouts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="goto-analytics"
            style={styles.actionCard}
            onPress={() => router.push("/analytics")}
            activeOpacity={0.7}
          >
            <Ionicons name="trending-up-outline" size={24} color={colors.brand} />
            <Text style={styles.actionTitle}>Analytics</Text>
            <Text style={styles.actionMeta}>Trends, 1RM, plateau</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, marginTop: 4, fontSize: 14 },
  startCard: { backgroundColor: colors.bg2, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", marginTop: spacing.xl },
  startTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: spacing.md },
  startSubtitle: { color: colors.textMuted, marginTop: 4, fontSize: 13, textAlign: "center" },
  activeCard: { backgroundColor: colors.bg2, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.brand },
  liveRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginRight: 8 },
  liveText: { color: colors.danger, fontWeight: "800", fontSize: 11, letterSpacing: 1.2 },
  activeName: { color: colors.text, fontSize: 20, fontWeight: "800" },
  activeDuration: { color: colors.brand, fontSize: 40, fontWeight: "900", marginTop: spacing.sm, fontVariant: ["tabular-nums"] },
  activeMeta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  actions: { flexDirection: "row", marginTop: spacing.xl, gap: 10 },
  actionCard: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  actionTitle: { color: colors.text, fontWeight: "800", fontSize: 15, marginTop: spacing.sm },
  actionMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
