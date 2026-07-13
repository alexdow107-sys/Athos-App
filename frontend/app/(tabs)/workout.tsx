import React, { useCallback, useState, useMemo, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Animated, Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useWorkout } from "@/src/context/WorkoutContext";
import { colors, radius, spacing } from "@/src/theme";
import { fmtDuration, fmtVolume, fmtDistance } from "@/src/utils/format";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Return the Sunday that starts the week containing `date`
function weekSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ── Mini calendar modal ─────────────────────────────────────────────────────

function CalendarModal({
  visible, onClose, onSelect,
}: { visible: boolean; onClose: () => void; onSelect: (d: Date) => void }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = Array.from({ length: startDow + daysInMonth }, (_, i) =>
    i < startDow ? null : new Date(viewYear, viewMonth, i - startDow + 1)
  );

  const monthName = firstDay.toLocaleString("en-US", { month: "long" });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    const nowM = today.getMonth(); const nowY = today.getFullYear();
    if (viewYear > nowY || (viewYear === nowY && viewMonth >= nowM)) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cal.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={cal.sheet}>
          <View style={cal.header}>
            <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={cal.monthLabel}>{monthName} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={cal.dowRow}>
            {DAY_LABELS.map(d => <Text key={d} style={cal.dowLabel}>{d}</Text>)}
          </View>
          <View style={cal.grid}>
            {cells.map((d, i) => {
              if (!d) return <View key={i} style={cal.cell} />;
              const isToday = sameDay(d, today);
              const isFuture = d > today;
              return (
                <TouchableOpacity
                  key={i} style={cal.cell}
                  disabled={isFuture}
                  onPress={() => { onSelect(d); onClose(); }}
                >
                  <View style={[cal.dayCircle, isToday && cal.dayCircleToday]}>
                    <Text style={[cal.dayNum, isToday && cal.dayNumToday, isFuture && cal.dayNumFuture]}>
                      {d.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function WorkoutTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { active, elapsed, startWorkout, cancelWorkout } = useWorkout();
  const [starting, setStarting] = useState(false);
  const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
  const [allCardio, setAllCardio] = useState<any[]>([]);
  const [showCal, setShowCal] = useState(false);

  // Which date is "selected" — drives week shown + day filter
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const isToday = sameDay(selectedDate, today);

  // The Sunday that starts the displayed week
  const weekStart = useMemo(() => weekSunday(selectedDate), [selectedDate]);

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }), [weekStart]);

  const loadData = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const [wRes, cRes] = await Promise.all([
        api<{ workouts: any[] }>(`/workouts/user/${user.user_id}?limit=100`).catch(() => ({ workouts: [] })),
        api<{ cardio: any[] }>(`/cardio?limit=200`).catch(() => ({ cardio: [] })),
      ]);
      setAllWorkouts(wRes.workouts || []);
      setAllCardio(cRes.cardio || []);
    } catch {}
  }, [user?.user_id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Workouts & cardio for selected day
  const dayWorkouts = useMemo(() =>
    allWorkouts.filter(w => sameDay(new Date(w.started_at), selectedDate)),
    [allWorkouts, selectedDate]);

  const dayCardio = useMemo(() =>
    allCardio.filter(c => sameDay(new Date(c.date + "T00:00:00"), selectedDate)),
    [allCardio, selectedDate]);

  // Days that have activity in the current week view
  const activeDays = useMemo(() => {
    const set = new Set<string>();
    for (const w of allWorkouts) {
      const d = new Date(w.started_at); d.setHours(0, 0, 0, 0);
      set.add(isoDate(d));
    }
    for (const c of allCardio) {
      set.add(isoDate(new Date(c.date + "T00:00:00")));
    }
    return set;
  }, [allWorkouts, allCardio]);

  // Weekly totals for the displayed week
  const weeklyStats = useMemo(() => {
    const wEnd = new Date(weekStart); wEnd.setDate(weekStart.getDate() + 7);
    const weekW = allWorkouts.filter(w => { const d = new Date(w.started_at); return d >= weekStart && d < wEnd; });
    const weekC = allCardio.filter(c => { const d = new Date(c.date); return d >= weekStart && d < wEnd; });
    return {
      sessions: weekW.length,
      cardioSessions: weekC.length,
      volume: weekW.reduce((s, w) => s + (w.total_volume || 0), 0),
      duration: weekW.reduce((s, w) => s + (w.duration_seconds || 0), 0) +
        weekC.reduce((s, c) => s + (c.duration_seconds || 0), 0),
    };
  }, [allWorkouts, allCardio, weekStart]);

  const onDiscardActive = () => {
    if (Platform.OS === "web") {
      if (!window.confirm("Discard workout? This will permanently delete your active workout.")) return;
      cancelWorkout();
      return;
    }
    Alert.alert(
      "Discard workout?",
      "This will permanently delete your active workout.",
      [
        { text: "Keep going", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => { cancelWorkout(); } },
      ]
    );
  };

  const onStart = async () => {
    setStarting(true);
    try { await startWorkout(); router.push("/workout/active"); }
    catch (e: any) { Alert.alert("Failed", e.message || "Could not start workout"); }
    finally { setStarting(false); }
  };

  const goToWeek = (offset: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offset * 7);
    // Don't go into future weeks
    if (d > today) return;
    const sel = new Date(d);
    // If offset forward brings us into a future-week, clamp to today
    const futureCheck = new Date(d); futureCheck.setDate(d.getDate() + 6);
    setSelectedDate(futureCheck > today ? today : sel);
  };

  const resetToToday = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  };

  const isFutureWeek = weekStart > today;
  const isTodayWeek = sameDay(weekStart, weekSunday(today));

  const weekLabel = isTodayWeek
    ? "This Week"
    : weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " +
      weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <SafeAreaView style={styles.safe} testID="workout-tab" edges={["top"]}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Workout</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {!isToday && (
            <TouchableOpacity onPress={resetToToday} style={styles.todayChip}>
              <Text style={styles.todayChipText}>Today</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowCal(true)} style={styles.iconBtn}>
            <Ionicons name="calendar-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => goToWeek(-1)} style={styles.weekArrow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity
          onPress={() => goToWeek(1)}
          style={[styles.weekArrow, isTodayWeek && { opacity: 0.2 }]}
          disabled={isTodayWeek}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Day strip */}
      <View style={styles.weekStrip}>
        {weekDates.map((d) => {
          const sel = sameDay(d, selectedDate);
          const tod = sameDay(d, today);
          const has = activeDays.has(isoDate(d));
          const future = d > today;
          return (
            <TouchableOpacity
              key={d.toISOString()}
              style={styles.dayCol}
              onPress={() => !future && setSelectedDate(d)}
              disabled={future}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayLabel, tod && styles.dayLabelToday, sel && styles.dayLabelSel]}>
                {DAY_LABELS[d.getDay()]}
              </Text>
              <View style={[
                styles.dayCircle,
                sel && styles.dayCircleSel,
                tod && !sel && styles.dayCircleToday,
              ]}>
                <Text style={[
                  styles.dayNum,
                  future && styles.dayNumFuture,
                  sel && styles.dayNumSel,
                  tod && !sel && styles.dayNumToday,
                ]}>
                  {d.getDate()}
                </Text>
              </View>
              {has && <View style={[styles.dot, sel && styles.dotSel]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Active workout banner */}
        {active && (
          <View style={styles.activeCard} testID="active-workout-card">
            <View style={styles.activeTop}>
              <View style={styles.liveRow}>
                <PulseDot />
                <Text style={styles.liveLabel}>In progress</Text>
              </View>
              <TouchableOpacity onPress={onDiscardActive} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.discardLink}>Discard</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.activeName}>{active.name}</Text>
            <Text style={styles.activeDuration}>{fmtDuration(elapsed)}</Text>
            <Text style={styles.activeMeta}>{active.exercises.length} exercise{active.exercises.length !== 1 ? "s" : ""}</Text>
            <TouchableOpacity testID="resume-workout-button" style={styles.primaryBtn} onPress={() => router.push("/workout/active")} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Resume workout</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textInverse} />
            </TouchableOpacity>
          </View>
        )}

        {/* Start buttons */}
        {!active && (
          <View style={styles.startRow}>
            <TouchableOpacity testID="start-workout-button" style={[styles.startCard, { flex: 1 }]} onPress={onStart} activeOpacity={0.85} disabled={starting}>
              <View style={styles.startIcon}>
                <Ionicons name="barbell-outline" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.startTitle}>Start Workout</Text>
                <Text style={styles.startSub}>Log sets and PRs</Text>
              </View>
              <View style={styles.startCircle}>
                <Ionicons name="add" size={22} color={colors.brand} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity testID="log-cardio-button" style={[styles.startCard, { flex: 1 }]} onPress={() => router.push("/workout/add-cardio")} activeOpacity={0.85}>
              <View style={[styles.startIcon, { backgroundColor: "rgba(61,122,82,0.18)" }]}>
                <Ionicons name="walk-outline" size={20} color={colors.accentGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.startTitle}>Log Cardio</Text>
                <Text style={styles.startSub}>Run, cycle, swim…</Text>
              </View>
              <View style={[styles.startCircle, { borderColor: colors.accentGreen }]}>
                <Ionicons name="add" size={22} color={colors.accentGreen} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Selected day content */}
        {(dayWorkouts.length > 0 || dayCardio.length > 0) ? (
          <>
            <Text style={styles.sectionHeader}>
              {isToday ? "Today" : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </Text>
            <View style={styles.activityCard}>
              {dayWorkouts.map((w, i) => (
                <React.Fragment key={w.workout_id}>
                  {i > 0 && <View style={styles.divider} />}
                  <TouchableOpacity style={styles.activityRow} onPress={() => router.push(`/workout/${w.workout_id}`)} activeOpacity={0.7}>
                    <View style={styles.activityIcon}>
                      <Ionicons name="barbell-outline" size={17} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityName}>{w.name}</Text>
                      <Text style={styles.activityMeta}>
                        {fmtDuration(w.duration_seconds)}
                        {w.total_volume ? `  ·  ${fmtVolume(w.total_volume, user?.weight_unit || "kg")}` : ""}
                        {w.prs?.length ? `  ·  ${w.prs.length} PR` : ""}
                      </Text>
                    </View>
                    <View style={styles.arrowCircle}><Ionicons name="arrow-forward" size={13} color={colors.textInverse} /></View>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
              {dayCardio.length > 0 && dayWorkouts.length > 0 && <View style={styles.divider} />}
              {dayCardio.map((c, i) => (
                <React.Fragment key={c.cardio_id || i}>
                  {i > 0 && <View style={styles.divider} />}
                  <TouchableOpacity style={styles.activityRow} onPress={() => router.push(`/workout/edit-cardio?id=${c.cardio_id}`)} activeOpacity={0.7}>
                    <View style={[styles.activityIcon, { backgroundColor: "rgba(61,122,82,0.18)" }]}>
                      <Ionicons name={cardioIcon(c.type)} size={17} color={colors.accentGreen} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityName}>{c.type}</Text>
                      <Text style={styles.activityMeta}>
                        {fmtDuration(c.duration_seconds)}
                        {c.distance_km != null ? `  ·  ${fmtDistance(c.distance_km, (user?.distance_unit as any) || "km")}` : ""}
                        {c.notes ? `  ·  ${c.notes}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.arrowCircle, { backgroundColor: colors.accentGreen }]}><Ionicons name="arrow-forward" size={13} color={colors.textInverse} /></View>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyDay}>
            <Text style={styles.emptyDayText}>
              {isToday ? "No activity yet today" : "No activity on this day"}
            </Text>
          </View>
        )}

        {/* Weekly stats */}
        <Text style={styles.sectionHeader}>Week Summary</Text>
        <View style={styles.progressGrid}>
          <StatCard icon="flash-outline" value={String(weeklyStats.sessions + weeklyStats.cardioSessions)} label="Sessions" />
          <StatCard icon="time-outline" value={fmtDuration(weeklyStats.duration)} label="Active time" />
          <StatCard icon="barbell-outline" value={fmtVolume(weeklyStats.volume, user?.weight_unit || "kg")} label="Volume lifted" wide />
        </View>

        {/* Tools */}
        <Text style={styles.sectionHeader}>More</Text>
        <View style={styles.menuCard}>
          <MenuRow testID="goto-routines" icon="repeat-outline" title="Routines" sub="Reusable workout templates" onPress={() => router.push("/routines" as any)} />
          <View style={styles.menuDivider} />
          <MenuRow testID="goto-plan" icon="calendar-outline" title="My Plan" sub="View your weekly training split" onPress={() => router.push("/plan")} />
          <View style={styles.menuDivider} />
          <MenuRow testID="build-plan-cta" icon="options-outline" title="Build a Plan" sub="Personalised split from your goals" onPress={() => router.push("/plan-questionnaire")} />
          <View style={styles.menuDivider} />
          <MenuRow testID="goto-analytics" icon="trending-up-outline" title="Analytics" sub="Strength trends, volume, and PRs" onPress={() => router.push("/analytics")} />
        </View>

      </ScrollView>

      <CalendarModal
        visible={showCal}
        onClose={() => setShowCal(false)}
        onSelect={(d) => { d.setHours(0, 0, 0, 0); setSelectedDate(d); }}
      />
    </SafeAreaView>
  );
}

function StatCard({ icon, value, label, wide }: { icon: any; value: string; label: string; wide?: boolean }) {
  return (
    <View style={[styles.progressCard, wide && { flex: 2 }]}>
      <View style={styles.progressIconWrap}>
        <Ionicons name={icon} size={14} color={colors.brand} />
      </View>
      <Text style={styles.progressVal}>{value}</Text>
      <Text style={styles.progressLbl}>{label}</Text>
    </View>
  );
}

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.9, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ width: 12, height: 12, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute", width: 12, height: 12, borderRadius: 6,
        backgroundColor: colors.brand, transform: [{ scale }], opacity,
      }} />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand }} />
    </View>
  );
}

function cardioIcon(type: string): any {
  const t = (type || "").toLowerCase();
  if (t.includes("run")) return "walk-outline";
  if (t.includes("cycl") || t.includes("bike")) return "bicycle-outline";
  if (t.includes("swim")) return "water-outline";
  if (t.includes("row")) return "boat-outline";
  if (t.includes("walk")) return "walk-outline";
  return "fitness-outline";
}

function MenuRow({ icon, title, sub, onPress, testID }: {
  icon: any; title: string; sub: string; onPress: () => void; testID?: string;
}) {
  return (
    <TouchableOpacity testID={testID} style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={19} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    backgroundColor: colors.bg2, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  title: { fontSize: 20, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  todayChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: colors.brandLight,
  },
  todayChipText: { color: colors.brand, fontSize: 13, fontWeight: "700" },
  iconBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },

  weekNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: 8,
    backgroundColor: colors.bg2,
  },
  weekArrow: { padding: 4 },
  weekLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },

  weekStrip: {
    flexDirection: "row", justifyContent: "space-around",
    backgroundColor: colors.bg2, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  dayCol: { alignItems: "center", gap: 4, minWidth: 38 },
  dayLabel: { fontSize: 10, fontWeight: "600", color: colors.textMuted, letterSpacing: 0.3 },
  dayLabelToday: { color: colors.textSecondary },
  dayLabelSel: { color: colors.brand, fontWeight: "800" },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayCircleSel: { backgroundColor: colors.brand },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.brand },
  dayNum: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  dayNumFuture: { color: colors.textMuted, opacity: 0.4 },
  dayNumSel: { color: colors.textInverse, fontWeight: "900" },
  dayNumToday: { color: colors.brand, fontWeight: "800" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brand, opacity: 0.6 },
  dotSel: { backgroundColor: colors.textInverse, opacity: 0.8 },

  scroll: { paddingBottom: 80 },

  activeCard: {
    backgroundColor: colors.bg2, borderRadius: radius.lg,
    padding: spacing.lg, margin: spacing.lg, marginBottom: 0,
    borderWidth: 1, borderColor: colors.border,
  },
  activeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveLabel: { color: colors.brand, fontWeight: "700", fontSize: 12 },
  discardLink: { color: colors.textMuted, fontSize: 13 },
  activeName: { fontSize: 19, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  activeDuration: { fontSize: 46, fontWeight: "900", color: colors.text, marginVertical: 4, fontVariant: ["tabular-nums"] },
  activeMeta: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13,
  },
  primaryBtnText: { color: colors.textInverse, fontWeight: "800", fontSize: 15 },

  startRow: { flexDirection: "column", gap: 8, margin: spacing.lg, marginBottom: 0 },
  startCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.bg2, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  startIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center",
  },
  startTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  startSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  startCircle: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 2, borderColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },

  sectionHeader: {
    fontSize: 11, fontWeight: "800", color: colors.textMuted,
    letterSpacing: 1, textTransform: "uppercase",
    paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm,
  },

  emptyDay: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  emptyDayText: { color: colors.textMuted, fontSize: 13, fontStyle: "italic" },

  activityCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bg2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: 62 },
  activityRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  activityIcon: {
    width: 38, height: 38, borderRadius: radius.md,
    backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center",
  },
  activityName: { fontSize: 14, fontWeight: "700", color: colors.text },
  activityMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  arrowCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },

  progressGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: spacing.lg },
  progressCard: {
    flex: 1, backgroundColor: colors.bg2, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    borderTopWidth: 2, borderTopColor: colors.brand,
  },
  progressIconWrap: {
    width: 26, height: 26, borderRadius: radius.sm,
    backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.sm,
  },
  progressVal: { fontSize: 20, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  progressLbl: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600" },

  menuCard: {
    backgroundColor: colors.bg2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.lg, overflow: "hidden",
  },
  menuRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  menuIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center",
  },
  menuTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  menuSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  menuDivider: { height: 1, backgroundColor: colors.divider, marginLeft: 64 },
});

// ── Calendar modal styles ────────────────────────────────────────────────────
const cal = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  sheet: {
    backgroundColor: colors.bg2, borderRadius: radius.xl,
    padding: spacing.lg, width: 320,
    borderWidth: 1, borderColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  navBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 15, fontWeight: "800", color: colors.text },
  dowRow: { flexDirection: "row", marginBottom: 6 },
  dowLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayCircleToday: { backgroundColor: colors.brand },
  dayNum: { fontSize: 13, fontWeight: "600", color: colors.text },
  dayNumToday: { color: colors.textInverse, fontWeight: "900" },
  dayNumFuture: { color: colors.textMuted, opacity: 0.3 },
});
