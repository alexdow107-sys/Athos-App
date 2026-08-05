import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform,
  FlatList, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useWorkout, LoggedExercise, SetData } from "@/src/context/WorkoutContext";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { fmtDuration } from "@/src/utils/format";
import { api } from "@/src/api/client";
import { DecimalInput } from "@/src/components/DecimalInput";

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    active, elapsed, restRemaining, restDuration, restRunning,
    addSet, removeSet, updateSet,
    removeExercise, updateExercise, setRestDuration, startRest, pauseRest, resetRest,
    cancelWorkout, setActive,
  } = useWorkout();

  const [finishing, setFinishing] = useState(false);
  const [name, setName] = useState(active?.name || "Workout");
  const [machineFor, setMachineFor] = useState<number | null>(null);
  const [machines, setMachines] = useState<string[]>([]);

  React.useEffect(() => {
    if (active?.name) setName(active.name);
  }, [active?.workout_id]);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await api<{ default_machines: string[] }>("/exercises?category=machine");
        setMachines(r.default_machines || []);
      } catch {}
    })();
  }, []);

  // ----- Horizontal exercise pager (swipe between exercises) -----
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<any>>(null);
  const [page, setPage] = useState(0);
  const exCount = active?.exercises.length ?? 0;
  const prevCount = useRef(exCount);

  const goTo = (i: number) => listRef.current?.scrollToOffset({ offset: i * width, animated: true });
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  useEffect(() => {
    if (exCount > prevCount.current) {
      // a new exercise was just added -> slide over to it
      const t = setTimeout(() => goTo(exCount - 1), 60);
      prevCount.current = exCount;
      return () => clearTimeout(t);
    }
    if (page > exCount) goTo(exCount); // clamp after a removal
    prevCount.current = exCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exCount]);

  if (!active) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active workout</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.linkBtn}>
            <Text style={styles.linkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const onFinish = () => {
    const totalCompletedSets = active.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0,
    );
    if (totalCompletedSets === 0) {
      Alert.alert("Nothing logged yet", "Log at least one set (reps) before finishing.");
      return;
    }
    router.push("/workout/save" as any);
  };

  const onDiscard = () => {
    if (Platform.OS === "web") {
      if (!window.confirm("Discard workout? All progress will be lost.")) return;
      cancelWorkout();
      router.replace("/(tabs)/workout" as any);
      return;
    }
    Alert.alert("Discard workout?", "All progress will be lost", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          cancelWorkout();
          router.replace("/(tabs)/workout" as any);
        },
      },
    ]);
  };

  // Persist a renamed workout back into the active-workout context (+ storage)
  // so the save screen and finish payload use the new name instead of the original.
  const persistName = () => {
    const trimmed = name.trim();
    if (active && trimmed && trimmed !== active.name) {
      setActive({ ...active, name: trimmed });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="active-workout-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="active-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.timer}>{fmtDuration(elapsed)}</Text>
            <Text style={styles.timerLabel}>{active.exercises.length} exercises</Text>
          </View>
          <TouchableOpacity testID="finish-workout-btn" onPress={onFinish} style={styles.finishBtn} disabled={finishing}>
            <Text style={styles.finishText}>{finishing ? "..." : "Finish"}</Text>
          </TouchableOpacity>
        </View>

        {/* Manual rest timer — sits at the top; start / pause / reset yourself */}
        <View style={[styles.restBar, restRunning && styles.restBarRunning]} testID="rest-timer-bar">
          <Ionicons name="timer-outline" size={18} color={restRunning ? "#fff" : colors.brand} />
          <Text style={[styles.restTime, restRunning && { color: "#fff" }]}>{fmtDuration(restRemaining)}</Text>
          <View style={styles.restPresets}>
            {[60, 90, 120, 180].map((s) => (
              <TouchableOpacity
                key={s}
                testID={`rest-preset-${s}`}
                onPress={() => setRestDuration(s)}
                style={[styles.restPreset, restDuration === s && styles.restPresetActive]}
              >
                <Text style={[styles.restPresetText, restDuration === s && styles.restPresetTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity testID="rest-toggle-btn" onPress={restRunning ? pauseRest : startRest} style={styles.restPlay}>
            <Ionicons name={restRunning ? "pause" : "play"} size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity testID="rest-reset-btn" onPress={resetRest} style={styles.restReset}>
            <Ionicons name="refresh" size={16} color={restRunning ? "#fff" : colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Workout name + page navigation */}
        <View style={styles.pagerTop}>
          <TextInput
            testID="workout-name-input"
            value={name}
            onChangeText={setName}
            onBlur={persistName}
            placeholder="Workout name"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
          />
          {exCount > 0 && (
            <View style={styles.pagerNav}>
              <Text style={styles.pageCounter}>
                {page < exCount ? `Exercise ${page + 1} of ${exCount}` : "Add exercise"}
                <Text style={styles.swipeHint}>   swipe ‹ ›</Text>
              </Text>
              <View style={styles.dotsRow}>
                {active.exercises.map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <View style={[styles.dot, page === i && styles.dotActive]} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => goTo(exCount)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <View style={[styles.dotAdd, page === exCount && styles.dotAddActive]}>
                    <Ionicons name="add" size={11} color={page === exCount ? "#fff" : colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Swipeable exercise pages — one exercise per slide, swipe left for the next */}
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          data={[...active.exercises, { __add: true }] as any[]}
          keyExtractor={(item: any, i) => (item.__add ? "add-slide" : `${item.exercise_id}-${i}`)}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index }: { item: any; index: number }) =>
            item.__add ? (
              <ScrollView style={{ width }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {exCount === 0 && (
                  <View style={styles.emptyExercise}>
                    <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyExerciseText}>Add your first exercise</Text>
                  </View>
                )}
                <TouchableOpacity
                  testID="add-exercise-btn"
                  style={styles.addExerciseBtn}
                  onPress={() => router.push("/workout/add-exercise")}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={22} color={colors.brand} />
                  <Text style={styles.addExerciseText}>Add Exercise</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="discard-btn" style={styles.discardBtn} onPress={onDiscard}>
                  <Text style={styles.discardText}>Discard workout</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView style={{ width }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                <ExerciseCard
                  index={index}
                  ex={item}
                  weightUnit={user?.weight_unit || "kg"}
                  onRemove={() => removeExercise(index)}
                  onAddSet={() => addSet(index)}
                  onRemoveSet={(si) => removeSet(index, si)}
                  onUpdateSet={(si, u) => updateSet(index, si, u)}
                  onToggleUnilateral={(val) => updateExercise(index, { is_unilateral: val })}
                  onChangeMachine={() => setMachineFor(index)}
                  onNotes={(notes) => updateExercise(index, { notes })}
                />
                <TouchableOpacity style={styles.nextBtn} onPress={() => goTo(index + 1)} activeOpacity={0.7}>
                  <Text style={styles.nextText}>{index + 1 < exCount ? "Next exercise" : "Add another exercise"}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.brand} />
                </TouchableOpacity>
              </ScrollView>
            )
          }
        />

        {/* Machine picker modal */}
        {machineFor !== null && (
          <View style={styles.modal}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select machine</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                <TouchableOpacity onPress={() => { updateExercise(machineFor, { machine: null }); setMachineFor(null); }} style={styles.machineItem}>
                  <Text style={styles.machineText}>No specific machine</Text>
                </TouchableOpacity>
                {machines.map((m) => (
                  <TouchableOpacity
                    key={m}
                    testID={`machine-${m.replace(/\s/g, "-")}`}
                    onPress={() => { updateExercise(machineFor, { machine: m }); setMachineFor(null); }}
                    style={styles.machineItem}
                  >
                    <Text style={styles.machineText}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={() => setMachineFor(null)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface ExCardProps {
  index: number;
  ex: LoggedExercise;
  weightUnit: string;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (si: number) => void;
  onUpdateSet: (si: number, u: Partial<SetData>) => void;
  onToggleUnilateral: (v: boolean) => void;
  onChangeMachine: () => void;
  onNotes: (n: string) => void;
}

const ExerciseCard: React.FC<ExCardProps> = ({
  index, ex, weightUnit, onRemove, onAddSet, onRemoveSet, onUpdateSet,
  onToggleUnilateral, onChangeMachine, onNotes,
}) => {
  const [history, setHistory] = useState<any>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await api<any>(`/exercises/${ex.exercise_id}/history`);
        setHistory(r);
        // Carry forward the last session's notes so you can review/edit them.
        if (r?.last_session?.notes && !ex.notes) onNotes(r.last_session.notes);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.exercise_id]);

  const prevSets: any[] = history?.last_session?.sets || [];
  const pr = history?.personal_record;

  return (
    <View style={styles.exCard} testID={`exercise-card-${index}`}>
      <View style={styles.exHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exName}>{ex.exercise_name}</Text>
          {ex.machine ? <Text style={styles.exMeta}>{ex.machine}</Text> : null}
          {pr ? (
            <Text style={styles.exHistory}>
              🏆 PR {pr.weight} {weightUnit}{pr.reps ? ` × ${pr.reps}` : ""} · {history.session_count} session{history.session_count !== 1 ? "s" : ""}
            </Text>
          ) : (
            <Text style={styles.exHistory}>No previous data</Text>
          )}
          {prevSets.length > 0 ? (
            <Text style={styles.exLast} numberOfLines={1}>
              Last: {prevSets.map((s: any) => ex.is_unilateral
                ? `${s.left_weight ?? 0}/${s.right_weight ?? 0}×${s.left_reps ?? 0}`
                : `${s.weight ?? 0}×${s.reps ?? 0}`).join("  ·  ")}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity testID={`remove-exercise-${index}`} onPress={onRemove} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Always-visible quick settings */}
      <View style={styles.quickSettings}>
        <TouchableOpacity
          testID={`unilateral-toggle-${index}`}
          onPress={() => onToggleUnilateral(!ex.is_unilateral)}
          style={[styles.quickChip, ex.is_unilateral && styles.quickChipActive]}
        >
          <Ionicons name="git-compare-outline" size={13} color={ex.is_unilateral ? "#fff" : colors.textSecondary} />
          <Text style={[styles.quickChipText, ex.is_unilateral && { color: "#fff" }]}>L / R</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`select-machine-${index}`}
          onPress={onChangeMachine}
          style={[styles.quickChip, !!ex.machine && styles.quickChipActive]}
        >
          <Ionicons name="cube-outline" size={13} color={ex.machine ? "#fff" : colors.textSecondary} />
          <Text style={[styles.quickChipText, ex.machine && { color: "#fff" }]} numberOfLines={1}>
            {ex.machine || "Machine"}
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        testID={`ex-notes-${index}`}
        placeholder="Notes about this exercise (form cues, machine seat #, etc.)"
        value={ex.notes || ""}
        placeholderTextColor={colors.textMuted}
        onChangeText={onNotes}
        style={styles.notesInputAlwaysOn}
        multiline
      />

      {/* Set table header */}
      <View style={styles.setHeaderRow}>
        <Text style={[styles.setColLabel, { width: 28 }]}>SET</Text>
        {ex.is_unilateral ? (
          <>
            <Text style={[styles.setColLabel, { flex: 1 }]}>L: {weightUnit} × REPS</Text>
            <Text style={[styles.setColLabel, { flex: 1 }]}>R: {weightUnit} × REPS</Text>
          </>
        ) : (
          <>
            <Text style={[styles.setColLabel, { flex: 1 }]}>{weightUnit.toUpperCase()}</Text>
            <Text style={[styles.setColLabel, { flex: 1 }]}>REPS</Text>
          </>
        )}
        <View style={{ width: 36 }} />
      </View>

      {ex.sets.map((s, si) => {
        const prev = prevSets[si];
        const ph = (v: any) => (v != null && v !== 0 ? String(v) : "0");
        return (
        <View key={si} style={[styles.setRow, s.completed && styles.setRowCompleted]} testID={`set-row-${index}-${si}`}>
          <Text style={styles.setIndex}>{si + 1}</Text>
          {ex.is_unilateral ? (
            <>
              <View style={[styles.uniGroup, { flex: 1 }]}>
                <DecimalInput
                  testID={`set-${index}-${si}-left-weight`}
                  value={s.left_weight ?? 0}
                  onChange={(n) => onUpdateSet(si, { left_weight: n })}
                  placeholder={ph(prev?.left_weight)}
                  style={styles.setInput}
                />
                <Text style={styles.uniX}>×</Text>
                <TextInput
                  testID={`set-${index}-${si}-left-reps`}
                  value={s.left_reps ? String(s.left_reps) : ""}
                  onChangeText={(t) => onUpdateSet(si, { left_reps: parseInt(t, 10) || 0 })}
                  placeholder={ph(prev?.left_reps)} keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  style={styles.setInput}
                />
              </View>
              <View style={[styles.uniGroup, { flex: 1 }]}>
                <DecimalInput
                  testID={`set-${index}-${si}-right-weight`}
                  value={s.right_weight ?? 0}
                  onChange={(n) => onUpdateSet(si, { right_weight: n })}
                  placeholder={ph(prev?.right_weight)}
                  style={styles.setInput}
                />
                <Text style={styles.uniX}>×</Text>
                <TextInput
                  testID={`set-${index}-${si}-right-reps`}
                  value={s.right_reps ? String(s.right_reps) : ""}
                  onChangeText={(t) => onUpdateSet(si, { right_reps: parseInt(t, 10) || 0 })}
                  placeholder={ph(prev?.right_reps)} keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  style={styles.setInput}
                />
              </View>
            </>
          ) : (
            <>
              <DecimalInput
                testID={`set-${index}-${si}-weight`}
                value={s.weight ?? 0}
                onChange={(n) => onUpdateSet(si, { weight: n })}
                placeholder={ph(prev?.weight)}
                style={[styles.setInput, { flex: 1, marginRight: 6 }]}
              />
              <TextInput
                testID={`set-${index}-${si}-reps`}
                value={s.reps ? String(s.reps) : ""}
                onChangeText={(t) => onUpdateSet(si, { reps: parseInt(t, 10) || 0 })}
                placeholder={ph(prev?.reps)} keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
                style={[styles.setInput, { flex: 1 }]}
              />
            </>
          )}
          <TouchableOpacity
            testID={`delete-set-${index}-${si}`}
            onPress={() => onRemoveSet(si)}
            style={styles.deleteSetBtn}
            activeOpacity={0.7}
            accessibilityLabel="Delete set"
          >
            <Ionicons name="close" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
        );
      })}

      <TouchableOpacity testID={`add-set-${index}`} onPress={onAddSet} style={styles.addSetBtn}>
        <Ionicons name="add" size={16} color={colors.brand} />
        <Text style={styles.addSetText}>Add Set</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  timer: { color: colors.brand, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  timerLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: "700" },
  finishBtn: { backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md },
  finishText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  restBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.bg2, paddingHorizontal: spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  restBarRunning: { backgroundColor: colors.brand, borderBottomColor: colors.brand },
  restTime: { color: colors.text, fontWeight: "900", fontSize: 18, fontVariant: ["tabular-nums"], minWidth: 56 },
  restPresets: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1, justifyContent: "center" },
  restPreset: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  restPresetActive: { backgroundColor: colors.text },
  restPresetText: { color: colors.textSecondary, fontSize: 12, fontWeight: "800" },
  restPresetTextActive: { color: colors.bg },
  restPlay: { width: 36, height: 32, borderRadius: radius.md, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  restReset: { width: 34, height: 32, borderRadius: radius.md, backgroundColor: colors.bg3, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.md, paddingBottom: 60 },
  pagerTop: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  pagerNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  pageCounter: { color: colors.textSecondary, fontSize: 12, fontWeight: "800" },
  swipeHint: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  dotsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg3 },
  dotActive: { backgroundColor: colors.brand, width: 10, height: 10, borderRadius: 5 },
  dotAdd: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.bg3, alignItems: "center", justifyContent: "center" },
  dotAddActive: { backgroundColor: colors.brand },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginTop: 4 },
  nextText: { color: colors.brand, fontSize: 14, fontWeight: "800" },
  nameInput: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing.sm, paddingVertical: 4 },
  exCard: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  exHeader: { flexDirection: "row", alignItems: "flex-start" },
  exName: { color: colors.brand, fontSize: 16, fontWeight: "800" },
  exMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  exHistory: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  exLast: { color: colors.textSecondary, fontSize: 11, marginTop: 2, fontWeight: "600" },
  settingsBox: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.sm, paddingTop: spacing.sm },
  settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  settingsLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  settingsValue: { color: colors.brand, fontSize: 13, fontWeight: "700" },
  restChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  restChipActive: { backgroundColor: colors.brand },
  restChipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  restChipTextActive: { color: "#fff" },
  notesInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, fontSize: 13, color: colors.text, marginTop: 8 },
  notesInputAlwaysOn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, fontSize: 13, color: colors.text, marginTop: 8, minHeight: 40 },
  quickSettings: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  quickChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg3, gap: 4, maxWidth: 160 },
  quickChipActive: { backgroundColor: colors.brand },
  quickChipText: { color: colors.textSecondary, fontSize: 11, fontWeight: "800" },
  removeExBtn: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingVertical: 6 },
  removeExText: { color: colors.danger, fontSize: 13, fontWeight: "700", marginLeft: 6 },
  setHeaderRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.divider },
  setColLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center" },
  setRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  setRowCompleted: { backgroundColor: "rgba(61,122,82,0.18)" },
  setIndex: { width: 28, textAlign: "center", color: colors.textSecondary, fontWeight: "800", fontSize: 14 },
  setInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 4, textAlign: "center", fontSize: 15, fontWeight: "700", color: colors.text, backgroundColor: colors.bg },
  uniGroup: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  uniX: { color: colors.textMuted, marginHorizontal: 4, fontWeight: "700" },
  deleteSetBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.bg3, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  addSetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, marginTop: 6, backgroundColor: colors.brandLight, borderRadius: radius.md },
  addSetText: { color: colors.brand, fontSize: 13, fontWeight: "800", marginLeft: 6 },
  addExerciseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderWidth: 1, borderColor: colors.brand, borderStyle: "dashed", borderRadius: radius.lg, marginTop: spacing.sm },
  addExerciseText: { color: colors.brand, fontSize: 15, fontWeight: "800", marginLeft: 8 },
  discardBtn: { alignItems: "center", marginTop: spacing.xl, padding: 12 },
  discardText: { color: colors.danger, fontWeight: "700", fontSize: 14 },
  emptyExercise: { alignItems: "center", padding: spacing.xl },
  emptyExerciseText: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  linkBtn: { marginTop: 12 },
  linkText: { color: colors.brand, fontWeight: "700" },
  modal: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 12 },
  machineItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  machineText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  modalCancel: { marginTop: 12, padding: 12, alignItems: "center" },
  modalCancelText: { color: colors.brand, fontWeight: "800" },
});
