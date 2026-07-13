import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useWorkout } from "@/src/context/WorkoutContext";
import { colors, radius, spacing } from "@/src/theme";

export default function RoutinesScreen() {
  const router = useRouter();
  const { active, startWorkoutFromRoutine } = useWorkout();
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ routines: any[] }>("/routines");
      setRoutines(r.routines || []);
    } catch {
      setRoutines([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onStart = async (routine: any) => {
    if (active) {
      Alert.alert("Workout in progress", "Finish or discard your current workout before starting a new one.");
      return;
    }
    setBusy(true);
    try {
      await startWorkoutFromRoutine(routine);
      router.replace("/workout/active");
    } catch (e: any) {
      Alert.alert("Failed", e.message || "Could not start workout");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = (routine: any) => {
    const doDelete = async () => {
      try {
        await api(`/routines/${routine.routine_id}`, { method: "DELETE" });
        setRoutines((prev) => prev.filter((r) => r.routine_id !== routine.routine_id));
      } catch (e: any) {
        Alert.alert("Failed", e.message);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${routine.name}"?`)) doDelete();
      return;
    }
    Alert.alert("Delete routine?", `"${routine.name}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="routines-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Routines</Text>
        <TouchableOpacity testID="new-routine-btn" onPress={() => router.push("/routine/new" as any)} style={styles.iconBtn}>
          <Ionicons name="add" size={26} color={colors.brand} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {routines.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="repeat-outline" size={44} color={colors.border} />
              <Text style={styles.emptyTitle}>No routines yet</Text>
              <Text style={styles.emptySub}>
                Build a reusable template, or save one from a workout you finish. Then start it and just log weight & reps.
              </Text>
              <TouchableOpacity testID="empty-new-routine-btn" style={styles.newBtn} onPress={() => router.push("/routine/new" as any)}>
                <Ionicons name="add" size={18} color={colors.textInverse} />
                <Text style={styles.newBtnText}>New routine</Text>
              </TouchableOpacity>
            </View>
          ) : (
            routines.map((r) => (
              <View key={r.routine_id} style={styles.card} testID={`routine-${r.routine_id}`}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{r.name}</Text>
                    <Text style={styles.cardMeta}>{r.exercises?.length || 0} exercise{(r.exercises?.length || 0) !== 1 ? "s" : ""}</Text>
                  </View>
                  <TouchableOpacity testID={`delete-routine-${r.routine_id}`} onPress={() => onDelete(r)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                {r.exercises?.length > 0 && (
                  <Text style={styles.cardExercises} numberOfLines={2}>
                    {r.exercises.map((e: any) => e.exercise_name).join(" · ")}
                  </Text>
                )}
                <TouchableOpacity
                  testID={`start-routine-${r.routine_id}`}
                  style={styles.startBtn}
                  onPress={() => onStart(r)}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <Ionicons name="play" size={15} color={colors.textInverse} />
                  <Text style={styles.startBtnText}>Start workout</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  empty: { alignItems: "center", padding: spacing.xl, gap: 10, marginTop: 40 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 6 },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19, paddingHorizontal: 12 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: colors.brand, borderRadius: radius.md },
  newBtnText: { color: colors.textInverse, fontWeight: "800", fontSize: 14 },
  card: { backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardName: { fontSize: 16, fontWeight: "800", color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  cardExercises: { fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 18 },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md, paddingVertical: 11, backgroundColor: colors.brand, borderRadius: radius.md },
  startBtnText: { color: colors.textInverse, fontWeight: "800", fontSize: 14 },
});
