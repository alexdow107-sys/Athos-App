import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useWorkout } from "@/src/context/WorkoutContext";
import { colors, radius, spacing } from "@/src/theme";

export default function AddExerciseScreen() {
  const router = useRouter();
  const { addExercise } = useWorkout();
  const [query, setQuery] = useState("");
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const r = await api<any>(`/exercises?${params.toString()}`);
        setExercises(r.exercises);
      } finally {
        setLoading(false);
      }
    })();
  }, [query]);

  const onPick = (ex: any) => {
    addExercise({
      exercise_id: ex.exercise_id,
      exercise_name: ex.name,
      is_unilateral: ex.is_unilateral || false,
    });
    router.back();
  };

  const onCreate = async () => {
    if (!newName.trim()) return;
    try {
      const r = await api<{ exercise: any }>("/exercises", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          category: "barbell",
          muscle_group: "other",
          is_unilateral: false,
        }),
      });
      addExercise({
        exercise_id: r.exercise.exercise_id,
        exercise_name: r.exercise.name,
        is_unilateral: false,
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="add-exercise-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Exercise</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginLeft: 12 }} />
        <TextInput
          testID="exercise-search-input"
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery("")} style={{ paddingHorizontal: 12 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {creating ? (
        <View style={styles.createBox}>
          <Text style={styles.createLabel}>Custom exercise name</Text>
          <TextInput
            testID="custom-name-input"
            value={newName} onChangeText={setNewName}
            placeholder="My exercise" placeholderTextColor={colors.textMuted}
            style={styles.createInput}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity testID="custom-cancel-btn" onPress={() => { setCreating(false); setNewName(""); }} style={[styles.createBtn, styles.createBtnSecondary]}>
              <Text style={styles.createBtnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="custom-save-btn" onPress={onCreate} style={[styles.createBtn, styles.createBtnPrimary]}>
              <Text style={styles.createBtnPrimaryText}>Create & Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity testID="create-custom-btn" style={styles.customRow} onPress={() => setCreating(true)} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={22} color={colors.brand} />
          <Text style={styles.customText}>Create custom exercise</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(e) => e.exercise_id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`pick-exercise-${item.exercise_id}`}
              style={styles.exerciseRow}
              onPress={() => onPick(item)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{item.name}</Text>
                {!item.system ? <Text style={styles.exMeta}>Custom</Text> : null}
              </View>
              <Ionicons name="add" size={22} color={colors.brand} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No exercises found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 4 },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  searchWrap: { flexDirection: "row", alignItems: "center", margin: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.bg2, borderRadius: radius.lg },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 11, fontSize: 15, color: colors.text },
  customRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 12, gap: 10, backgroundColor: colors.brandLight + "60" },
  customText: { color: colors.brand, fontWeight: "800", fontSize: 14 },
  createBox: { padding: spacing.md, backgroundColor: colors.brandLight + "60" },
  createLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  createInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, marginBottom: 8, fontSize: 14, color: colors.text, backgroundColor: colors.bg },
  createBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: "center" },
  createBtnPrimary: { backgroundColor: colors.brand },
  createBtnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  createBtnSecondary: { backgroundColor: colors.bg3 },
  createBtnSecondaryText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  exerciseRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  exName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  exMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2, textTransform: "capitalize" },
  empty: { padding: spacing.xl, alignItems: "center" },
  emptyText: { color: colors.textMuted },
});
