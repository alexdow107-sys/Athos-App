import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

interface RoutineExercise {
  exercise_id: string;
  exercise_name: string;
  is_unilateral: boolean;
  machine?: string | null;
  target_sets: number;
}

export default function NewRoutineScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const r = await api<any>(`/exercises?${params.toString()}`);
        if (!cancelled) setResults((r.exercises || []).slice(0, 30));
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  const addExercise = (ex: any) => {
    setExercises((prev) => [
      ...prev,
      {
        exercise_id: ex.exercise_id,
        exercise_name: ex.name,
        is_unilateral: ex.is_unilateral || false,
        machine: null,
        target_sets: 3,
      },
    ]);
  };

  const removeExercise = (idx: number) => setExercises((prev) => prev.filter((_, i) => i !== idx));
  const changeSets = (idx: number, delta: number) =>
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, target_sets: Math.max(1, Math.min(10, e.target_sets + delta)) } : e)));

  const onSave = async () => {
    if (!name.trim()) { Alert.alert("Name your routine", "Give this routine a name first."); return; }
    if (exercises.length === 0) { Alert.alert("Add exercises", "Add at least one exercise to the routine."); return; }
    setSaving(true);
    try {
      await api("/routines", { method: "POST", body: JSON.stringify({ name: name.trim(), exercises }) });
      router.back();
    } catch (e: any) {
      Alert.alert("Failed", e.message || "Could not save routine");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="new-routine-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>New Routine</Text>
          <TouchableOpacity testID="save-routine-btn" onPress={onSave} disabled={saving} style={styles.saveBtn}>
            <Text style={styles.saveText}>{saving ? "..." : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <TextInput
            testID="routine-name-input"
            value={name}
            onChangeText={setName}
            placeholder="Routine name (e.g. Push Day)"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
          />

          {/* Added exercises */}
          {exercises.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{exercises.length} exercise{exercises.length !== 1 ? "s" : ""}</Text>
              {exercises.map((ex, idx) => (
                <View key={`${ex.exercise_id}-${idx}`} style={styles.addedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addedName}>{ex.exercise_name}</Text>
                    <Text style={styles.addedMeta}>{ex.target_sets} sets</Text>
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity onPress={() => changeSets(idx, -1)} style={styles.stepBtn}><Ionicons name="remove" size={16} color={colors.text} /></TouchableOpacity>
                    <Text style={styles.stepVal}>{ex.target_sets}</Text>
                    <TouchableOpacity onPress={() => changeSets(idx, 1)} style={styles.stepBtn}><Ionicons name="add" size={16} color={colors.text} /></TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => removeExercise(idx)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Exercise search */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add exercises</Text>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginLeft: 12 }} />
              <TextInput
                testID="routine-exercise-search"
                placeholder="Search exercises"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
              />
            </View>
            {searching ? (
              <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
            ) : (
              results.map((item) => (
                <TouchableOpacity
                  key={item.exercise_id}
                  testID={`add-exercise-${item.exercise_id}`}
                  style={styles.resultRow}
                  onPress={() => addExercise(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Ionicons name="add-circle" size={22} color={colors.brand} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.brand, borderRadius: radius.md },
  saveText: { color: colors.textInverse, fontWeight: "800", fontSize: 14 },
  nameInput: { fontSize: 20, fontWeight: "800", color: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm },
  addedRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  addedName: { fontSize: 15, fontWeight: "700", color: colors.text },
  addedMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.bg3, borderRadius: radius.full, paddingHorizontal: 4, paddingVertical: 2 },
  stepBtn: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepVal: { fontSize: 14, fontWeight: "800", color: colors.text, minWidth: 16, textAlign: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg2, borderRadius: radius.lg, marginBottom: spacing.sm },
  searchInput: { flex: 1, paddingHorizontal: 10, paddingVertical: 11, fontSize: 15, color: colors.text },
  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  resultName: { fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 },
});
