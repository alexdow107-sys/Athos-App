import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

interface EditSet {
  weight?: number; reps?: number;
  left_weight?: number; left_reps?: number; right_weight?: number; right_reps?: number;
  completed?: boolean;
}
interface EditEx {
  exercise_id: string; exercise_name: string; is_unilateral?: boolean;
  machine?: string | null; notes?: string; sets: EditSet[]; rest_seconds?: number;
}

export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const wu = user?.weight_unit || "kg";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [hours, setHours] = useState("0");
  const [mins, setMins] = useState("0");
  const [exercises, setExercises] = useState<EditEx[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api<any>(`/workouts/${id}`);
      const w = r.workout;
      setName(w.name || "Workout");
      const dur = w.duration_seconds || 0;
      setHours(String(Math.floor(dur / 3600)));
      setMins(String(Math.floor((dur % 3600) / 60)));
      setExercises((w.exercises || []).map((ex: any) => ({ ...ex, sets: [...(ex.sets || [])] })));
    } catch (e: any) {
      Alert.alert("Failed to load", e?.message || "");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const setSetField = (ei: number, si: number, patch: Partial<EditSet>) =>
    setExercises((prev) => prev.map((ex, i) => i !== ei ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j !== si ? s : { ...s, ...patch }),
    }));

  const addSet = (ei: number) =>
    setExercises((prev) => prev.map((ex, i) => i !== ei ? ex : {
      ...ex, sets: [...ex.sets, ex.is_unilateral
        ? { left_weight: 0, left_reps: 0, right_weight: 0, right_reps: 0, completed: true }
        : { weight: 0, reps: 0, completed: true }],
    }));

  const removeSet = (ei: number, si: number) =>
    setExercises((prev) => prev.map((ex, i) => i !== ei ? ex : {
      ...ex, sets: ex.sets.filter((_, j) => j !== si),
    }));

  const removeExercise = (ei: number) =>
    setExercises((prev) => prev.filter((_, i) => i !== ei));

  const onSave = async () => {
    setSaving(true);
    try {
      const duration_seconds = (parseInt(hours, 10) || 0) * 3600 + (parseInt(mins, 10) || 0) * 60;
      await api(`/workouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() || "Workout", duration_seconds, exercises }),
      });
      router.back();
    } catch (e: any) {
      const msg = e?.message || "Could not save";
      if (Platform.OS === "web") window.alert("Failed: " + msg); else Alert.alert("Failed", msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.brand} style={{ marginTop: 64 }} /></SafeAreaView>;
  }

  const numStr = (v: any) => (v ? String(v) : "");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="edit-workout-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="edit-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Workout</Text>
          <TouchableOpacity testID="edit-save-btn" onPress={onSave} disabled={saving} style={styles.saveBtn}>
            <Text style={styles.saveText}>{saving ? "..." : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Name</Text>
          <TextInput value={name} onChangeText={setName} style={styles.nameInput} placeholderTextColor={colors.textMuted} />

          <Text style={styles.label}>Duration</Text>
          <View style={styles.durRow}>
            <TextInput testID="edit-hours" value={hours} onChangeText={setHours} keyboardType="number-pad" style={styles.durInput} />
            <Text style={styles.durUnit}>h</Text>
            <TextInput testID="edit-mins" value={mins} onChangeText={setMins} keyboardType="number-pad" style={styles.durInput} />
            <Text style={styles.durUnit}>min</Text>
          </View>

          {exercises.map((ex, ei) => (
            <View key={`${ex.exercise_id}-${ei}`} style={styles.exCard}>
              <View style={styles.exHeader}>
                <Text style={styles.exName}>{ex.exercise_name}</Text>
                <TouchableOpacity onPress={() => removeExercise(ei)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
              {ex.sets.map((s, si) => (
                <View key={si} style={styles.setRow}>
                  <Text style={styles.setIdx}>{si + 1}</Text>
                  {ex.is_unilateral ? (
                    <>
                      <TextInput value={numStr(s.left_weight)} onChangeText={(t) => setSetField(ei, si, { left_weight: parseFloat(t) || 0 })} keyboardType="decimal-pad" placeholder="L wt" placeholderTextColor={colors.textMuted} style={styles.setInput} />
                      <TextInput value={numStr(s.left_reps)} onChangeText={(t) => setSetField(ei, si, { left_reps: parseInt(t, 10) || 0 })} keyboardType="number-pad" placeholder="L reps" placeholderTextColor={colors.textMuted} style={styles.setInput} />
                      <TextInput value={numStr(s.right_weight)} onChangeText={(t) => setSetField(ei, si, { right_weight: parseFloat(t) || 0 })} keyboardType="decimal-pad" placeholder="R wt" placeholderTextColor={colors.textMuted} style={styles.setInput} />
                      <TextInput value={numStr(s.right_reps)} onChangeText={(t) => setSetField(ei, si, { right_reps: parseInt(t, 10) || 0 })} keyboardType="number-pad" placeholder="R reps" placeholderTextColor={colors.textMuted} style={styles.setInput} />
                    </>
                  ) : (
                    <>
                      <TextInput value={numStr(s.weight)} onChangeText={(t) => setSetField(ei, si, { weight: parseFloat(t) || 0 })} keyboardType="decimal-pad" placeholder={wu} placeholderTextColor={colors.textMuted} style={[styles.setInput, { flex: 1 }]} />
                      <TextInput value={numStr(s.reps)} onChangeText={(t) => setSetField(ei, si, { reps: parseInt(t, 10) || 0 })} keyboardType="number-pad" placeholder="reps" placeholderTextColor={colors.textMuted} style={[styles.setInput, { flex: 1 }]} />
                    </>
                  )}
                  <TouchableOpacity onPress={() => removeSet(ei, si)} style={styles.delSet} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={15} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => addSet(ei)} style={styles.addSet}>
                <Ionicons name="add" size={15} color={colors.brand} />
                <Text style={styles.addSetText}>Add set</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  saveBtn: { backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full },
  saveText: { color: colors.textInverse, fontWeight: "800", fontSize: 14 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.md, marginBottom: 6 },
  nameInput: { fontSize: 18, fontWeight: "800", color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.bg2 },
  durRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  durInput: { width: 64, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.text, backgroundColor: colors.bg2 },
  durUnit: { color: colors.textSecondary, fontSize: 14, fontWeight: "700", marginRight: 6 },
  exCard: { backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md },
  exHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  exName: { color: colors.brand, fontSize: 15, fontWeight: "800", flex: 1 },
  setRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5 },
  setIdx: { width: 18, textAlign: "center", color: colors.textMuted, fontWeight: "800" },
  setInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 4, textAlign: "center", fontSize: 14, fontWeight: "700", color: colors.text, backgroundColor: colors.bg, minWidth: 48, flexGrow: 1 },
  delSet: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.bg3 },
  addSet: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, marginTop: 4, backgroundColor: colors.brandLight, borderRadius: radius.md },
  addSetText: { color: colors.brand, fontWeight: "800", fontSize: 13 },
});
