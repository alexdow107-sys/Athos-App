import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { fmtDuration, fmtVolume, fmtDistance } from "@/src/utils/format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const CARDIO_ICONS: Record<string, any> = {
  run: "walk-outline",
  running: "walk-outline",
  walk: "walk-outline",
  walking: "walk-outline",
  cycle: "bicycle-outline",
  cycling: "bicycle-outline",
  bike: "bicycle-outline",
  swim: "water-outline",
  swimming: "water-outline",
  row: "fitness-outline",
  rowing: "fitness-outline",
  hike: "trail-sign-outline",
  hiking: "trail-sign-outline",
  default: "pulse-outline",
};

function cardioIcon(type: string): any {
  if (!type) return CARDIO_ICONS.default;
  const key = type.toLowerCase().trim();
  return CARDIO_ICONS[key] ?? CARDIO_ICONS.default;
}

type DayEntry = { _type: "workout" | "cardio"; _item: any };

export default function CalendarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [byDate, setByDate] = useState<Record<string, DayEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const [calRes, cardioRes] = await Promise.all([
        api<{ workouts_by_date: Record<string, any[]> }>(`/workouts/user/${user.user_id}/calendar?year=${year}&month=${month}`),
        api<{ cardio: any[] }>(`/cardio?limit=500`).catch(() => ({ cardio: [] })),
      ]);

      const merged: Record<string, DayEntry[]> = {};

      // Add workouts
      for (const [date, workouts] of Object.entries(calRes.workouts_by_date)) {
        if (!merged[date]) merged[date] = [];
        for (const w of workouts) merged[date].push({ _type: "workout", _item: w });
      }

      // Add cardio filtered to current month
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      for (const c of (cardioRes.cardio || [])) {
        const date = (c.date || "").slice(0, 10);
        if (!date.startsWith(prefix)) continue;
        if (!merged[date]) merged[date] = [];
        merged[date].push({ _type: "cardio", _item: c });
      }

      setByDate(merged);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Build calendar grid
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
  const selectedEntries = selectedDate ? byDate[selectedDate] || [] : [];

  const distUnit = (user?.distance_unit as any) || "km";
  const weightUnit = user?.weight_unit || "kg";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="calendar-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand}
          onRefresh={() => { setRefreshing(true); load(true); }} />}
      >
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
            const entries = byDate[k] || [];
            const hasWorkout = entries.some(e => e._type === "workout");
            const hasCardio = entries.some(e => e._type === "cardio");
            const has = entries.length > 0;
            const isToday = year === today.getFullYear() && month === today.getMonth() + 1 && d === today.getDate();
            const isSelected = k === selectedDate;
            return (
              <TouchableOpacity
                key={i}
                testID={`calendar-day-${d}`}
                style={styles.cell}
                onPress={() => setSelectedDate(has ? (isSelected ? null : k) : null)}
                activeOpacity={0.7}
              >
                <View style={[styles.dayBubble, isSelected && styles.dayBubbleSelected, isToday && !isSelected && styles.dayBubbleToday]}>
                  <Text style={[styles.dayText, (isSelected || isToday) && { color: isSelected ? "#fff" : colors.brand }]}>{d}</Text>
                </View>
                {(hasWorkout || hasCardio) && (
                  <View style={styles.dotRow}>
                    {hasWorkout && <View style={[styles.dot, { backgroundColor: colors.brand }]} />}
                    {hasCardio && <View style={[styles.dot, { backgroundColor: colors.accentGreen }]} />}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

        {selectedDate && selectedEntries.length > 0 && (
          <View style={styles.list}>
            <Text style={styles.sectionLabel}>Activity on {selectedDate}</Text>
            {selectedEntries.map((entry, idx) => {
              if (entry._type === "workout") {
                const w = entry._item;
                return (
                  <TouchableOpacity
                    key={`w-${w.workout_id}`}
                    testID={`calendar-workout-${w.workout_id}`}
                    style={styles.activityRow}
                    onPress={() => router.push(`/workout/${w.workout_id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.activityIcon, { backgroundColor: colors.brandLight }]}>
                      <Ionicons name="barbell-outline" size={16} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityName}>{w.name}</Text>
                      <Text style={styles.activityMeta}>
                        {fmtDuration(w.duration_seconds)} · {fmtVolume(w.total_volume || 0, weightUnit)} · {(w.exercises?.length || 0)} exercises{w.prs?.length ? ` · 🏆 ${w.prs.length} PR` : ""}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              } else {
                const c = entry._item;
                return (
                  <TouchableOpacity
                    key={`c-${c.cardio_id}`}
                    testID={`calendar-cardio-${c.cardio_id}`}
                    style={styles.activityRow}
                    onPress={() => router.push({ pathname: "/workout/edit-cardio", params: { id: c.cardio_id } })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.activityIcon, { backgroundColor: "#1E3A2A" }]}>
                      <Ionicons name={cardioIcon(c.type)} size={16} color={colors.accentGreen} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityName, { color: colors.accentGreen }]}>{c.type || "Cardio"}</Text>
                      <Text style={styles.activityMeta}>
                        {c.distance_km != null ? fmtDistance(c.distance_km, distUnit) + " · " : ""}
                        {fmtDuration(c.duration_seconds)}
                        {c.notes ? " · " + c.notes : ""}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              }
            })}
          </View>
        )}
        {!selectedDate && Object.keys(byDate).length === 0 && !loading && (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No activity this month</Text>
          </View>
        )}
        {!selectedDate && Object.keys(byDate).length > 0 && (
          <Text style={styles.hint}>Tap a highlighted day to see activity</Text>
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
  dotRow: { flexDirection: "row", gap: 3, marginTop: 2, height: 5 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  list: { padding: spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  activityRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bg2, marginBottom: 8, gap: 12 },
  activityIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  activityName: { color: colors.text, fontWeight: "800" },
  activityMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 32 },
  emptyText: { color: colors.textMuted, marginTop: 8 },
  hint: { color: colors.textMuted, textAlign: "center", padding: spacing.md, fontSize: 12 },
});
