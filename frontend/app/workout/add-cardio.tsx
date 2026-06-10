import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";
import { toKm } from "@/src/utils/format";
import { useAuth } from "@/src/context/AuthContext";

const CARDIO_TYPES = [
  { label: "Running",    icon: "walk-outline"        },
  { label: "Cycling",    icon: "bicycle-outline"     },
  { label: "Walking",    icon: "walk-outline"        },
  { label: "Swimming",   icon: "water-outline"       },
  { label: "Rowing",     icon: "boat-outline"        },
  { label: "HIIT",       icon: "flame-outline"       },
  { label: "Jump Rope",  icon: "fitness-outline"     },
  { label: "Stairmaster",icon: "stats-chart-outline" },
  { label: "Elliptical", icon: "sync-outline"        },
  { label: "Other",      icon: "fitness-outline"     },
] as const;

type Mode = "timer" | "manual";
type TimerState = "idle" | "running" | "paused" | "done";

function zeroPad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function fmtTimer(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${zeroPad(m)}:${zeroPad(s)}`;
  return `${zeroPad(m)}:${zeroPad(s)}`;
}

export default function AddCardioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const distUnit = (user?.distance_unit as "km" | "mi") || "km";
  const [mode, setMode] = useState<Mode>("timer");
  const [type, setType] = useState("");
  const [saving, setSaving] = useState(false);
  const [distanceKm, setDistanceKm] = useState("");
  const [notes, setNotes] = useState("");
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateStr, setDateStr] = useState(todayStr);

  // ── Timer mode state ──
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);   // seconds
  const startedAtRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);     // seconds accumulated before last pause
  const tickRef = useRef<any>(null);

  // ── Manual mode state ──
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");
  const [seconds, setSeconds] = useState("0");

  const manualDuration =
    (parseInt(hours) || 0) * 3600 +
    (parseInt(minutes) || 0) * 60 +
    (parseInt(seconds) || 0);

  const finalDuration = mode === "timer" ? elapsed : manualDuration;
  const canSave = type.length > 0 && finalDuration > 0 &&
    (mode === "manual" || timerState === "done" || timerState === "paused");

  // Switch modes — warn if timer is running
  const switchMode = (m: Mode) => {
    if (timerState === "running") {
      Alert.alert("Timer is running", "Stop the timer first before switching modes.");
      return;
    }
    setMode(m);
  };

  // Timer controls
  const startTimer = () => {
    startedAtRef.current = Date.now();
    tickRef.current = setInterval(() => {
      setElapsed(accumulatedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    setTimerState("running");
  };

  const pauseTimer = () => {
    clearInterval(tickRef.current);
    accumulatedRef.current = elapsed;
    setTimerState("paused");
  };

  const resumeTimer = () => {
    startedAtRef.current = Date.now();
    tickRef.current = setInterval(() => {
      setElapsed(accumulatedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    setTimerState("running");
  };

  const stopTimer = () => {
    clearInterval(tickRef.current);
    accumulatedRef.current = elapsed;
    setTimerState("done");
  };

  const resetTimer = () => {
    clearInterval(tickRef.current);
    accumulatedRef.current = 0;
    setElapsed(0);
    setTimerState("idle");
  };

  useEffect(() => () => clearInterval(tickRef.current), []);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const distVal = distanceKm ? parseFloat(distanceKm) : null;
      const r = await api<{ cardio: any }>("/cardio", {
        method: "POST",
        body: JSON.stringify({
          type,
          duration_seconds: finalDuration,
          // Always store in km internally; convert from user's unit if needed
          distance_km: distVal != null ? toKm(distVal, distUnit) : null,
          notes: notes.trim() || null,
          date: dateStr,
        }),
      });
      clearInterval(tickRef.current);
      // Go to the post/share screen
      router.replace(`/workout/save-cardio?id=${r.cardio.cardio_id}` as any);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (timerState === "running") {
            Alert.alert("Timer is running", "Stop the timer before leaving.", [{ text: "OK" }]);
            return;
          }
          router.back();
        }} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Cardio</Text>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!canSave || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.textInverse} />
            : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Activity type */}
        <Text style={styles.sectionLabel}>Activity</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {CARDIO_TYPES.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={[styles.typeChip, type === t.label && styles.typeChipSel]}
              onPress={() => setType(t.label)}
              activeOpacity={0.75}
            >
              <Ionicons name={t.icon as any} size={16} color={type === t.label ? colors.textInverse : colors.textSecondary} />
              <Text style={[styles.typeChipText, type === t.label && styles.typeChipTextSel]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Mode toggle */}
        <Text style={styles.sectionLabel}>Duration</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeBtn, mode === "timer" && styles.modeBtnActive]} onPress={() => switchMode("timer")} activeOpacity={0.75}>
            <Ionicons name="timer-outline" size={16} color={mode === "timer" ? colors.textInverse : colors.textSecondary} />
            <Text style={[styles.modeBtnText, mode === "timer" && styles.modeBtnTextActive]}>Track live</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeBtn, mode === "manual" && styles.modeBtnActive]} onPress={() => switchMode("manual")} activeOpacity={0.75}>
            <Ionicons name="create-outline" size={16} color={mode === "manual" ? colors.textInverse : colors.textSecondary} />
            <Text style={[styles.modeBtnText, mode === "manual" && styles.modeBtnTextActive]}>Enter manually</Text>
          </TouchableOpacity>
        </View>

        {/* ── Timer UI ── */}
        {mode === "timer" && (
          <View style={styles.timerCard}>
            <Text style={[
              styles.timerDisplay,
              timerState === "running" && styles.timerDisplayActive,
              timerState === "done" && styles.timerDisplayDone,
            ]}>
              {fmtTimer(elapsed)}
            </Text>
            <Text style={styles.timerHint}>
              {timerState === "idle"   ? "Press start when you begin" :
               timerState === "running" ? "Tracking…" :
               timerState === "paused"  ? "Paused — resume or stop" :
               "Session complete — save when ready"}
            </Text>

            <View style={styles.timerBtns}>
              {timerState === "idle" && (
                <TouchableOpacity style={[styles.timerBtn, styles.timerBtnStart]} onPress={startTimer} activeOpacity={0.85}>
                  <Ionicons name="play" size={20} color={colors.textInverse} />
                  <Text style={styles.timerBtnText}>Start</Text>
                </TouchableOpacity>
              )}

              {timerState === "running" && (
                <>
                  <TouchableOpacity style={[styles.timerBtn, styles.timerBtnPause]} onPress={pauseTimer} activeOpacity={0.85}>
                    <Ionicons name="pause" size={20} color={colors.textInverse} />
                    <Text style={styles.timerBtnText}>Pause</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.timerBtn, styles.timerBtnStop]} onPress={stopTimer} activeOpacity={0.85}>
                    <Ionicons name="stop" size={20} color={colors.textInverse} />
                    <Text style={styles.timerBtnText}>Stop</Text>
                  </TouchableOpacity>
                </>
              )}

              {timerState === "paused" && (
                <>
                  <TouchableOpacity style={[styles.timerBtn, styles.timerBtnStart]} onPress={resumeTimer} activeOpacity={0.85}>
                    <Ionicons name="play" size={20} color={colors.textInverse} />
                    <Text style={styles.timerBtnText}>Resume</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.timerBtn, styles.timerBtnStop]} onPress={stopTimer} activeOpacity={0.85}>
                    <Ionicons name="stop" size={20} color={colors.textInverse} />
                    <Text style={styles.timerBtnText}>Stop</Text>
                  </TouchableOpacity>
                </>
              )}

              {timerState === "done" && (
                <TouchableOpacity style={styles.timerBtnReset} onPress={resetTimer} activeOpacity={0.75}>
                  <Ionicons name="refresh" size={15} color={colors.textMuted} />
                  <Text style={styles.timerBtnResetText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Manual entry UI ── */}
        {mode === "manual" && (
          <>
            <View style={styles.durationRow}>
              <DurationField label="Hours"   value={hours}   onChange={setHours}   max={23} />
              <Text style={styles.durationSep}>:</Text>
              <DurationField label="Min"     value={minutes} onChange={setMinutes} max={59} />
              <Text style={styles.durationSep}>:</Text>
              <DurationField label="Sec"     value={seconds} onChange={setSeconds} max={59} />
            </View>
            <View style={styles.quickRow}>
              {[15, 20, 30, 45, 60].map(m => {
                const active = parseInt(minutes) === m && hours === "0" && seconds === "0";
                return (
                  <TouchableOpacity key={m} style={[styles.quickChip, active && styles.quickChipSel]}
                    onPress={() => { setHours("0"); setMinutes(String(m)); setSeconds("0"); }}>
                    <Text style={[styles.quickChipText, active && styles.quickChipTextSel]}>{m}m</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Distance — prominent for distance-based sports */}
        <Text style={styles.sectionLabel}>
          Distance{" "}
          {["Running","Cycling","Walking","Swimming","Rowing"].includes(type)
            ? <Text style={styles.recommended}>recommended</Text>
            : <Text style={styles.optional}>optional</Text>}
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={distanceKm}
            onChangeText={setDistanceKm}
            placeholder="0.0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            autoFocus={false}
          />
          <Text style={styles.inputUnit}>{distUnit}</Text>
        </View>

        {/* Date */}
        <Text style={styles.sectionLabel}>Date</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={dateStr}
            onChangeText={setDateStr}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes <Text style={styles.optional}>optional</Text></Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Pace, route, how it felt…"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function DurationField({ label, value, onChange, max }: {
  label: string; value: string; onChange: (v: string) => void; max: number;
}) {
  return (
    <View style={styles.durationField}>
      <TextInput
        style={styles.durationInput}
        value={value}
        onChangeText={v => onChange(String(Math.min(max, parseInt(v) || 0)))}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
      />
      <Text style={styles.durationLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    backgroundColor: colors.bg2, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  backBtn: { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  saveBtn: { backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.full },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: colors.textInverse, fontWeight: "800", fontSize: 14 },

  scroll: { padding: spacing.lg, paddingBottom: 80 },

  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: colors.textMuted,
    letterSpacing: 1, textTransform: "uppercase",
    marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  optional: { fontWeight: "500", textTransform: "none", letterSpacing: 0 },
  recommended: { fontWeight: "700", textTransform: "none", letterSpacing: 0, color: colors.brand },

  // Type chips (horizontal scroll)
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.bg2, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  typeChipSel: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeChipText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  typeChipTextSel: { color: colors.textInverse },

  // Mode toggle
  modeRow: {
    flexDirection: "row", gap: 8,
    backgroundColor: colors.bg3, borderRadius: radius.lg, padding: 4,
  },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 9, borderRadius: radius.md,
  },
  modeBtnActive: { backgroundColor: colors.brand },
  modeBtnText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  modeBtnTextActive: { color: colors.textInverse },

  // Timer card
  timerCard: {
    backgroundColor: colors.bg2, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: "center",
    borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.md,
  },
  timerDisplay: {
    fontSize: 64, fontWeight: "900", color: colors.textMuted,
    fontVariant: ["tabular-nums"], letterSpacing: -2,
  },
  timerDisplayActive: { color: colors.text },
  timerDisplayDone: { color: colors.brand },
  timerHint: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.lg },
  timerBtns: { flexDirection: "row", gap: 12 },
  timerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.full,
  },
  timerBtnStart: { backgroundColor: colors.brand },
  timerBtnPause: { backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border },
  timerBtnStop:  { backgroundColor: colors.danger },
  timerBtnText:  { color: colors.textInverse, fontSize: 15, fontWeight: "800" },
  timerBtnReset: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  timerBtnResetText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },

  // Manual duration
  durationRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.sm },
  durationField: { flex: 1, alignItems: "center" },
  durationInput: {
    backgroundColor: colors.bg2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    color: colors.text, fontSize: 28, fontWeight: "800",
    textAlign: "center", paddingVertical: 12, width: "100%",
    fontVariant: ["tabular-nums"],
  },
  durationLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  durationSep: { fontSize: 24, fontWeight: "800", color: colors.textMuted, marginTop: -16 },

  quickRow: { flexDirection: "row", gap: 8, marginTop: spacing.sm, flexWrap: "wrap" },
  quickChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  quickChipSel: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  quickChipText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  quickChipTextSel: { color: colors.brand },

  // Inputs
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  input: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600", paddingVertical: 12 },
  inputUnit: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  notesInput: { backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14, padding: spacing.md, minHeight: 80 },
});
