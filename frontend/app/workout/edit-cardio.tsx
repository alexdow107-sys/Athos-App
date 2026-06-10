import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";
import { toKm, fromKm } from "@/src/utils/format";
import { useAuth } from "@/src/context/AuthContext";

const CARDIO_TYPES = [
  { label: "Running", icon: "walk-outline" },
  { label: "Cycling", icon: "bicycle-outline" },
  { label: "Walking", icon: "walk-outline" },
  { label: "Swimming", icon: "water-outline" },
  { label: "Rowing", icon: "boat-outline" },
  { label: "HIIT", icon: "flame-outline" },
  { label: "Jump Rope", icon: "fitness-outline" },
  { label: "Stairmaster", icon: "stats-chart-outline" },
  { label: "Elliptical", icon: "sync-outline" },
  { label: "Other", icon: "fitness-outline" },
] as const;

export default function EditCardioScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const distUnit = (user?.distance_unit as "km" | "mi") || "km";

  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");
  const [seconds, setSeconds] = useState("0");
  const [distanceKm, setDistanceKm] = useState("");
  const [notes, setNotes] = useState("");
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<{ cardio: any }>(`/cardio/${id}`).then(r => {
      const c = r.cardio;
      setType(c.type || "");
      const total = c.duration_seconds || 0;
      setHours(String(Math.floor(total / 3600)));
      setMinutes(String(Math.floor((total % 3600) / 60)));
      setSeconds(String(total % 60));
      // Convert stored km to user's preferred unit for display
      if (c.distance_km != null) {
        const displayVal = fromKm(c.distance_km, distUnit);
        setDistanceKm(String(Math.round(displayVal * 100) / 100));
      } else {
        setDistanceKm("");
      }
      setNotes(c.notes || "");
      setDateStr(c.date || new Date().toISOString().slice(0, 10));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const durationSeconds =
    (parseInt(hours) || 0) * 3600 +
    (parseInt(minutes) || 0) * 60 +
    (parseInt(seconds) || 0);

  const canSave = type.length > 0 && durationSeconds > 0;

  const save = async () => {
    setSaving(true);
    try {
      await api(`/cardio/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          type,
          duration_seconds: durationSeconds,
          distance_km: distanceKm ? toKm(parseFloat(distanceKm), distUnit) : null,
          notes: notes.trim() || null,
          date: dateStr,
        }),
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not update");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert("Delete entry?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await api(`/cardio/${id}`, { method: "DELETE" }).catch(() => {});
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Cardio</Text>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!canSave || saving}
        >
          {saving ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionLabel}>Activity Type</Text>
        <View style={styles.typeGrid}>
          {CARDIO_TYPES.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={[styles.typeCard, type === t.label && styles.typeCardSel]}
              onPress={() => setType(t.label)}
              activeOpacity={0.75}
            >
              <Ionicons name={t.icon as any} size={20} color={type === t.label ? colors.textInverse : colors.textSecondary} />
              <Text style={[styles.typeLabel, type === t.label && styles.typeLabelSel]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Duration</Text>
        <View style={styles.durationRow}>
          <DurationField label="Hours" value={hours} onChange={setHours} max={23} />
          <Text style={styles.sep}>:</Text>
          <DurationField label="Min" value={minutes} onChange={setMinutes} max={59} />
          <Text style={styles.sep}>:</Text>
          <DurationField label="Sec" value={seconds} onChange={setSeconds} max={59} />
        </View>
        <View style={styles.quickRow}>
          {[15, 20, 30, 45, 60].map(m => (
            <TouchableOpacity key={m} style={[styles.quickChip, parseInt(minutes) === m && hours === "0" && seconds === "0" && styles.quickChipSel]}
              onPress={() => { setHours("0"); setMinutes(String(m)); setSeconds("0"); }}>
              <Text style={[styles.quickChipText, parseInt(minutes) === m && hours === "0" && seconds === "0" && styles.quickChipTextSel]}>{m}m</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Distance ({distUnit}) <Text style={styles.optional}>optional</Text></Text>
        <View style={styles.inputWrap}>
          <TextInput style={styles.input} value={distanceKm} onChangeText={setDistanceKm}
            placeholder="e.g. 5.2" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
          <Text style={styles.inputUnit}>{distUnit}</Text>
        </View>

        <Text style={styles.sectionLabel}>Date</Text>
        <View style={styles.inputWrap}>
          <TextInput style={[styles.input, { flex: 1 }]} value={dateStr} onChangeText={setDateStr}
            placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" />
        </View>

        <Text style={styles.sectionLabel}>Notes <Text style={styles.optional}>optional</Text></Text>
        <TextInput style={styles.notesInput} value={notes} onChangeText={setNotes}
          placeholder="How did it feel?" placeholderTextColor={colors.textMuted}
          multiline numberOfLines={3} textAlignVertical="top" />

        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteBtnText}>Delete this entry</Text>
        </TouchableOpacity>
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
  sectionLabel: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm, marginTop: spacing.lg },
  optional: { fontWeight: "500", textTransform: "none", letterSpacing: 0 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeCard: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  typeCardSel: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  typeLabelSel: { color: colors.textInverse },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  durationField: { flex: 1, alignItems: "center" },
  durationInput: { backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 28, fontWeight: "800", textAlign: "center", paddingVertical: 12, width: "100%", fontVariant: ["tabular-nums"] },
  durationLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  sep: { fontSize: 24, fontWeight: "800", color: colors.textMuted, marginTop: -16 },
  quickRow: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  quickChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  quickChipSel: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  quickChipText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  quickChipTextSel: { color: colors.brand },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  input: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600", paddingVertical: 12 },
  inputUnit: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  notesInput: { backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14, padding: spacing.md, minHeight: 80 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.xl, padding: spacing.md },
  deleteBtnText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
});
