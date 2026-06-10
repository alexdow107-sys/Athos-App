import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useWorkout, LoggedExercise, SetData } from "@/src/context/WorkoutContext";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { fmtDuration } from "@/src/utils/format";
import { api } from "@/src/api/client";

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    active, elapsed, restRemaining, restDuration,
    addSet, removeSet, updateSet, completeSet,
    removeExercise, updateExercise, startRestTimer, stopRestTimer,
    finishWorkout, cancelWorkout,
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
      Alert.alert("No completed sets", "Mark at least one set as complete before finishing.");
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

  const onSaveName = async () => {
    updateExercise; // unused noop ref
    if (active && name !== active.name) {
      // Update locally only; final name sent at finish
      // We use updateExercise side-effect via context update; we'll use setActive directly via name change
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

        {/* Rest timer */}
        {restRemaining > 0 && (
          <View style={styles.restBar} testID="rest-timer-bar">
            <Ionicons name="timer-outline" size={18} color="#fff" />
            <Text style={styles.restText}>Rest: {restRemaining}s</Text>
            <View style={styles.restProgress}>
              <View style={[styles.restProgressFill, { width: `${(restRemaining / restDuration) * 100}%` }]} />
            </View>
            <TouchableOpacity testID="skip-rest-btn" onPress={stopRestTimer} style={styles.restSkip}>
              <Text style={styles.restSkipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextInput
            testID="workout-name-input"
            value={name}
            onChangeText={(t) => { setName(t); updateExercise; }}
            onBlur={() => { /* name persisted at finish */ }}
            placeholder="Workout name"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
          />

          {active.exercises.length === 0 && (
            <View style={styles.emptyExercise}>
              <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyExerciseText}>Add your first exercise</Text>
            </View>
          )}

          {active.exercises.map((ex, idx) => (
            <ExerciseCard
              key={`${ex.exercise_id}-${idx}`}
              index={idx}
              ex={ex}
              weightUnit={user?.weight_unit || "kg"}
              onRemove={() => removeExercise(idx)}
              onAddSet={() => addSet(idx)}
              onRemoveSet={(si) => removeSet(idx, si)}
              onUpdateSet={(si, u) => updateSet(idx, si, u)}
              onCompleteSet={(si) => completeSet(idx, si)}
              onToggleUnilateral={(val) => updateExercise(idx, { is_unilateral: val })}
              onChangeMachine={() => setMachineFor(idx)}
              onChangeRest={(seconds) => updateExercise(idx, { rest_seconds: seconds })}
              onStartRest={() => startRestTimer(ex.rest_seconds || 90)}
              onNotes={(notes) => updateExercise(idx, { notes })}
            />
          ))}

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
  onCompleteSet: (si: number) => void;
  onToggleUnilateral: (v: boolean) => void;
  onChangeMachine: () => void;
  onChangeRest: (s: number) => void;
  onStartRest: () => void;
  onNotes: (n: string) => void;
}

const ExerciseCard: React.FC<ExCardProps> = ({
  index, ex, weightUnit, onRemove, onAddSet, onRemoveSet, onUpdateSet, onCompleteSet,
  onToggleUnilateral, onChangeMachine, onChangeRest, onStartRest, onNotes,
}) => {
  const [history, setHistory] = useState<any>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await api<any>(`/exercises/${ex.exercise_id}/history`);
        setHistory(r);
      } catch {}
    })();
  }, [ex.exercise_id]);

  const restOptions = [60, 90, 120, 180];

  return (
    <View style={styles.exCard} testID={`exercise-card-${index}`}>
      <View style={styles.exHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exName}>{ex.exercise_name}</Text>
          {ex.machine ? <Text style={styles.exMeta}>{ex.machine}</Text> : null}
          {history?.personal_record ? (
            <Text style={styles.exHistory}>
              PR: {Math.round(history.personal_record.estimated_1rm)} {weightUnit} · {history.session_count} sessions
            </Text>
          ) : (
            <Text style={styles.exHistory}>No previous data</Text>
          )}
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
        <View style={styles.restPicker}>
          <Ionicons name="timer-outline" size={13} color={colors.textSecondary} />
          {restOptions.map((r) => (
            <TouchableOpacity
              key={r}
              testID={`rest-${r}-${index}`}
              onPress={() => onChangeRest(r)}
              style={[styles.restMini, ex.rest_seconds === r && styles.restMiniActive]}
            >
              <Text style={[styles.restMiniText, ex.rest_seconds === r && { color: "#fff" }]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
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

      {ex.sets.map((s, si) => (
        <View key={si} style={[styles.setRow, s.completed && styles.setRowCompleted]} testID={`set-row-${index}-${si}`}>
          <Text style={styles.setIndex}>{si + 1}</Text>
          {ex.is_unilateral ? (
            <>
              <View style={[styles.uniGroup, { flex: 1 }]}>
                <TextInput
                  testID={`set-${index}-${si}-left-weight`}
                  value={String(s.left_weight ?? "")}
                  onChangeText={(t) => onUpdateSet(si, { left_weight: parseFloat(t) || 0 })}
                  placeholder="0" keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  style={styles.setInput}
                />
                <Text style={styles.uniX}>×</Text>
                <TextInput
                  testID={`set-${index}-${si}-left-reps`}
                  value={String(s.left_reps ?? "")}
                  onChangeText={(t) => onUpdateSet(si, { left_reps: parseInt(t, 10) || 0 })}
                  placeholder="0" keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  style={styles.setInput}
                />
              </View>
              <View style={[styles.uniGroup, { flex: 1 }]}>
                <TextInput
                  testID={`set-${index}-${si}-right-weight`}
                  value={String(s.right_weight ?? "")}
                  onChangeText={(t) => onUpdateSet(si, { right_weight: parseFloat(t) || 0 })}
                  placeholder="0" keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  style={styles.setInput}
                />
                <Text style={styles.uniX}>×</Text>
                <TextInput
                  testID={`set-${index}-${si}-right-reps`}
                  value={String(s.right_reps ?? "")}
                  onChangeText={(t) => onUpdateSet(si, { right_reps: parseInt(t, 10) || 0 })}
                  placeholder="0" keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  style={styles.setInput}
                />
              </View>
            </>
          ) : (
            <>
              <TextInput
                testID={`set-${index}-${si}-weight`}
                value={String(s.weight ?? "")}
                onChangeText={(t) => onUpdateSet(si, { weight: parseFloat(t) || 0 })}
                placeholder="0" keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
                style={[styles.setInput, { flex: 1, marginRight: 6 }]}
              />
              <TextInput
                testID={`set-${index}-${si}-reps`}
                value={String(s.reps ?? "")}
                onChangeText={(t) => onUpdateSet(si, { reps: parseInt(t, 10) || 0 })}
                placeholder="0" keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
                style={[styles.setInput, { flex: 1 }]}
              />
            </>
          )}
          <TouchableOpacity
            testID={`complete-set-${index}-${si}`}
            onPress={() => onCompleteSet(si)}
            onLongPress={() => onRemoveSet(si)}
            style={[styles.checkBtn, s.completed && styles.checkBtnActive]}
            activeOpacity={0.7}
            accessibilityLabel="Long press to delete set"
          >
            <Ionicons name={s.completed ? "checkmark" : "trash-outline"} size={16} color={s.completed ? "#fff" : colors.textMuted} />
          </TouchableOpacity>
        </View>
      ))}

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
  restBar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 10 },
  restText: { color: "#fff", fontWeight: "800", marginLeft: 8, marginRight: 12, fontSize: 13 },
  restProgress: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2 },
  restProgressFill: { height: 4, backgroundColor: "#fff", borderRadius: 2 },
  restSkip: { paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.2)" },
  restSkipText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  scroll: { padding: spacing.md, paddingBottom: 60 },
  nameInput: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing.md, paddingVertical: 4 },
  exCard: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  exHeader: { flexDirection: "row", alignItems: "flex-start" },
  exName: { color: colors.brand, fontSize: 16, fontWeight: "800" },
  exMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  exHistory: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
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
  restPicker: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.bg3, gap: 4 },
  restMini: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  restMiniActive: { backgroundColor: colors.brand },
  restMiniText: { color: colors.textSecondary, fontSize: 11, fontWeight: "800" },
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
  checkBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.bg3, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  checkBtnActive: { backgroundColor: colors.success },
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
