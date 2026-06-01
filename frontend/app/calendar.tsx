import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { fmtDuration, fmtVolume } from "@/src/utils/format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [byDate, setByDate] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await api<{ workouts_by_date: Record<string, any[]> }>(`/workouts/user/${user.user_id}/calendar?year=${year}&month=${month}`);
      setByDate(r.workouts_by_date);
    } finally {
      setLoading(false);
    }
  }, [year, month, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Build calendar
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const next = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };
  const prev = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };

  const dateKey = (d: number) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const selectedWorkouts = selectedDate ? byDate[selectedDate] || [] : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="calendar-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.monthRow}>
        <TouchableOpacity testID="prev-month-btn" onPress={prev}><Ionicons name="chevron-back" size={22} color={colors.text} /></TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTHS[month - 1]} {year}</Text>
        <TouchableOpacity testID="next-month-btn" onPress={next}><Ionicons name="chevron-forward" size={22} color={colors.text} /></TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => <Text key={i} style={styles.weekday}>{d}</Text>)}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
      ) : (
        <View style={styles.grid}>
          {cells.map((d, i) => {
            if (d === null) return <View key={i} style={styles.cell} />;
            const k = dateKey(d);
            const has = !!byDate[k];
            const isToday = year === today.getFullYear() && month === today.getMonth() + 1 && d === today.getDate();
            const isSelected = k === selectedDate;
            return (
              <TouchableOpacity
                key={i}
                testID={`calendar-day-${d}`}
                style={styles.cell}
                onPress={() => setSelectedDate(has ? k : null)}
                activeOpacity={0.7}
              >
                <View style={[styles.dayBubble, isSelected && styles.dayBubbleSelected, isToday && !isSelected && styles.dayBubbleToday]}>
                  <Text style={[styles.dayText, (isSelected || isToday) && { color: isSelected ? "#fff" : colors.brand }]}>{d}</Text>
                </View>
                {has && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {selectedDate && selectedWorkouts.length > 0 && (
          <View style={styles.list}>
            <Text style={styles.sectionLabel}>Workouts on {selectedDate}</Text>
            {selectedWorkouts.map((w) => (
              <TouchableOpacity
                key={w.workout_id}
                testID={`calendar-workout-${w.workout_id}`}
                style={styles.workoutRow}
                onPress={() => router.push(`/workout/${w.workout_id}`)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.workoutName}>{w.name}</Text>
                  <Text style={styles.workoutMeta}>{fmtDuration(w.duration_seconds)} · {fmtVolume(w.total_volume || 0, user?.weight_unit || "kg")} · {(w.exercises?.length || 0)} exercises{w.prs?.length ? ` · 🏆 ${w.prs.length} PR` : ""}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        {!selectedDate && Object.keys(byDate).length === 0 && !loading && (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No workouts this month</Text>
          </View>
        )}
        {!selectedDate && Object.keys(byDate).length > 0 && (
          <Text style={styles.hint}>Tap a highlighted day to see workouts</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md },
  monthLabel: { fontSize: 18, fontWeight: "800", color: colors.text },
  weekRow: { flexDirection: "row", paddingHorizontal: spacing.md },
  weekday: { flex: 1, textAlign: "center", color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.sm, marginTop: 4 },
  cell: { width: "14.285%", alignItems: "center", paddingVertical: 4 },
  dayBubble: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dayBubbleSelected: { backgroundColor: colors.brand },
  dayBubbleToday: { backgroundColor: colors.brandLight },
  dayText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brand, marginTop: 2 },
  dotSelected: { backgroundColor: colors.brand },
  list: { padding: spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  workoutRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bg2, marginBottom: 8 },
  workoutName: { color: colors.text, fontWeight: "800" },
  workoutMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 32 },
  emptyText: { color: colors.textMuted, marginTop: 8 },
  hint: { color: colors.textMuted, textAlign: "center", padding: spacing.md, fontSize: 12 },
});
