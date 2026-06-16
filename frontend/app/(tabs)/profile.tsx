import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { fmtDuration, fmtVolume, fmtDistance } from "@/src/utils/format";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Consecutive-day streak across workouts + cardio. Stays alive until a full day
// is missed — so an empty "today" doesn't zero it out before you've trained.
function computeStreak(workouts: any[], cardio: any[]): number {
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = new Set<string>();
  for (const w of workouts) days.add(key(new Date(w.started_at)));
  for (const c of cardio) days.add(key(new Date(c.date + "T00:00:00")));
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  if (!days.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(key(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getWeekDates(workouts: any[]) {
  const today = new Date();
  const dow = today.getDay();
  return DAYS.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    const dateStr = d.toDateString();
    const hasWorkout = workouts.some(w => new Date(w.started_at).toDateString() === dateStr);
    return { label, date: d.getDate(), dayIndex: i, isToday: i === dow, hasWorkout };
  });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [cardio, setCardio] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const [wRes, cRes] = await Promise.all([
        api<{ workouts: any[] }>(`/workouts/user/${user.user_id}?limit=60`).catch(() => ({ workouts: [] })),
        api<{ cardio: any[] }>("/cardio?limit=60").catch(() => ({ cardio: [] })),
      ]);
      setWorkouts(wRes.workouts || []);
      setCardio(cRes.cardio || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.user_id]);

  useFocusEffect(useCallback(() => {
    setLoading(true); load();
  }, [load]));

  if (!user) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={colors.brand} style={{ marginTop: 64 }} />
    </SafeAreaView>
  );

  const weekDates = getWeekDates(workouts);
  const todayDow = new Date().getDay();
  const streak = computeStreak(workouts, cardio);

  // Weekly stats
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek = workouts.filter(w => new Date(w.started_at) >= weekStart);
  const thisWeekCardio = cardio.filter(c => new Date(c.date + "T00:00:00") >= weekStart);
  const weekVolume = thisWeek.reduce((s, w) => s + (w.total_volume || 0), 0);
  const weekDuration = thisWeek.reduce((s, w) => s + (w.duration_seconds || 0), 0)
    + thisWeekCardio.reduce((s, c) => s + (c.duration_seconds || 0), 0);

  // Merge workouts and cardio, sort by date descending, take 6
  const recentActivity = [
    ...workouts.map(w => ({ ...w, _type: "workout", _date: new Date(w.started_at).getTime() })),
    ...cardio.map(c => ({ ...c, _type: "cardio", _date: new Date(c.date + "T00:00:00").getTime() })),
  ].sort((a, b) => b._date - a._date).slice(0, 6);

  return (
    <SafeAreaView style={styles.safe} testID="profile-screen" edges={["top"]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Profile</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity testID="goto-analytics-btn" onPress={() => router.push("/analytics")}>
            <Ionicons name="stats-chart-outline" size={21} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity testID="goto-settings-btn" onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={21} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand}
          onRefresh={() => { setRefreshing(true); load(); refresh(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile hero */}
        <LinearGradient
          colors={["#1E3A4A", colors.bg2]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={styles.hero}>
            <View style={styles.avatarRing}>
              <Avatar uri={user.profile_picture} name={user.display_name} size={72} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.displayName}>{user.display_name}</Text>
              <Text style={styles.username}>@{user.username}</Text>
              {user.bio ? <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text> : null}
              {streak > 0 && (
                <View style={styles.streakPill} testID="streak-pill">
                  <Text style={styles.streakFlame}>🔥</Text>
                  <Text style={styles.streakText}>{streak} day streak</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <TouchableOpacity testID="stat-workouts" style={styles.statBlock}>
            <Text style={styles.statValue}>{user.workouts_count ?? workouts.length}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity testID="stat-followers" style={styles.statBlock}
            onPress={() => router.push(`/followers/${user.user_id}?tab=followers`)}>
            <Text style={styles.statValue}>{user.followers_count || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity testID="stat-following" style={styles.statBlock}
            onPress={() => router.push(`/followers/${user.user_id}?tab=following`)}>
            <Text style={styles.statValue}>{user.following_count || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity testID="edit-profile-btn" style={styles.outlineBtn}
            onPress={() => router.push("/settings")}>
            <Text style={styles.outlineBtnText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="my-plan-btn" style={styles.outlineBtn}
            onPress={() => router.push("/plan")}>
            <Ionicons name="calendar-outline" size={14} color={colors.brand} />
            <Text style={[styles.outlineBtnText, { color: colors.brand }]}>My Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Week strip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
        </View>
        <View style={styles.weekStrip}>
          {weekDates.map((d) => (
            <View key={d.dayIndex} style={styles.dayCol}>
              <Text style={[styles.dayLabel, d.isToday && styles.dayLabelActive]}>{d.label}</Text>
              <View style={[
                styles.dayCircle,
                d.isToday && styles.dayCircleToday,
                d.hasWorkout && !d.isToday && styles.dayCircleDone,
              ]}>
                <Text style={[
                  styles.dayNum,
                  d.isToday && styles.dayNumToday,
                  d.hasWorkout && !d.isToday && styles.dayNumDone,
                ]}>{d.date}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Your Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
        </View>
        <View style={styles.progressGrid}>
          <ProfileStatCard icon="flash-outline" value={String(thisWeek.length)} label="Sessions" sub="this week" />
          <ProfileStatCard icon="time-outline" value={fmtDuration(weekDuration)} label="Total time" sub="this week" />
          <ProfileStatCard icon="barbell-outline" value={fmtVolume(weekVolume, user.weight_unit || "kg")} label="Volume lifted" sub="this week" wide />
        </View>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <>
            <View style={[styles.section, { marginTop: spacing.xl }]}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity testID="view-calendar-btn" onPress={() => router.push("/calendar")}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activityCard}>
              {recentActivity.map((item, i) => {
                const isCardio = item._type === "cardio";
                const dateStr = isCardio
                  ? new Date(item.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : new Date(item.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return (
                  <React.Fragment key={isCardio ? item.cardio_id : item.workout_id}>
                    {i > 0 && <View style={styles.activityDivider} />}
                    <TouchableOpacity
                      style={styles.activityRow}
                      onPress={() => isCardio
                        ? router.push(`/workout/edit-cardio?id=${item.cardio_id}`)
                        : router.push(`/workout/${item.workout_id}`)
                      }
                      activeOpacity={0.7}
                    >
                      <View style={[styles.activityIcon, isCardio && styles.activityIconCardio]}>
                        <Ionicons
                          name={isCardio ? cardioIcon(item.type) : "barbell-outline"}
                          size={17}
                          color={isCardio ? colors.accentGreen : colors.brand}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityName}>{isCardio ? item.type : item.name}</Text>
                        <Text style={styles.activityMeta}>
                          {dateStr}
                          {item.duration_seconds ? `  ·  ${fmtDuration(item.duration_seconds)}` : ""}
                          {isCardio && item.distance_km != null
                            ? `  ·  ${fmtDistance(item.distance_km, (user.distance_unit as any) || "km")}`
                            : ""}
                          {!isCardio && item.prs?.length ? `  ·  ${item.prs.length} PR` : ""}
                        </Text>
                      </View>
                      <View style={[styles.activityArrow, isCardio && styles.activityArrowCardio]}>
                        <Ionicons name="arrow-forward" size={14} color={colors.textInverse} />
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}

        {loading && (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        )}

        {!loading && workouts.length === 0 && cardio.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={44} color={colors.border} />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <TouchableOpacity testID="empty-start-btn" onPress={() => router.push("/(tabs)/workout")} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Log your first workout</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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

function ProfileStatCard({ icon, value, label, sub, wide }: { icon: any; value: string; label: string; sub: string; wide?: boolean }) {
  return (
    <View style={[styles.progressCard, wide && styles.progressCardWide]}>
      <View style={styles.progressIconWrap}>
        <Ionicons name={icon} size={14} color={colors.brand} />
      </View>
      <Text style={styles.progressVal}>{value}</Text>
      <Text style={styles.progressLbl}>{label}</Text>
      <Text style={styles.progressSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    backgroundColor: colors.bg2, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  topBarTitle: { fontSize: 20, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },

  // Hero
  heroGradient: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  hero: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg,
  },
  avatarRing: {
    borderRadius: 42, borderWidth: 2, borderColor: colors.brand,
    padding: 2,
  },
  heroInfo: { flex: 1 },
  displayName: { fontSize: 20, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  username: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  bio: { color: colors.textSecondary, fontSize: 13, marginTop: 5, lineHeight: 18 },
  streakPill: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
    backgroundColor: "rgba(194,90,53,0.18)", borderWidth: 1, borderColor: "rgba(194,90,53,0.40)",
  },
  streakFlame: { fontSize: 12 },
  streakText: { color: "#E8A87C", fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },

  statsRow: {
    flexDirection: "row", backgroundColor: colors.bg2,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
    paddingVertical: spacing.md,
  },
  statBlock: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "700", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },
  statDivider: { width: 1, backgroundColor: colors.divider, marginVertical: 4 },

  btnRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.bg2, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  outlineBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingVertical: 9, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg3,
  },
  outlineBtnText: { color: colors.text, fontWeight: "700", fontSize: 13 },

  // Week strip
  section: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  seeAll: { fontSize: 13, fontWeight: "700", color: colors.brand },

  weekStrip: {
    flexDirection: "row", justifyContent: "space-around",
    backgroundColor: colors.bg2, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.divider,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  dayCol: { alignItems: "center", gap: 5 },
  dayLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  dayLabelActive: { color: colors.brand, fontWeight: "800" },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayCircleToday: { backgroundColor: colors.brand },
  dayCircleDone: { backgroundColor: colors.brandLight, borderWidth: 1.5, borderColor: colors.brand },
  dayNum: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  dayNumToday: { color: colors.textInverse, fontWeight: "900" },
  dayNumDone: { color: colors.brand, fontWeight: "700" },

  // Progress
  progressGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: spacing.lg },
  progressCard: {
    flex: 1, minWidth: "40%",
    backgroundColor: colors.bg2, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    borderTopWidth: 2, borderTopColor: colors.brand,
  },
  progressCardWide: { flexBasis: "100%" },
  progressIconWrap: {
    width: 26, height: 26, borderRadius: radius.sm,
    backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.sm,
  },
  progressVal: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  progressLbl: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginTop: 2 },
  progressSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  // Activity
  activityCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bg2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  activityDivider: { height: 1, backgroundColor: colors.divider, marginLeft: 62 },
  activityRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  activityIcon: {
    width: 38, height: 38, borderRadius: radius.md,
    backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center",
  },
  activityName: { fontSize: 14, fontWeight: "700", color: colors.text },
  activityMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  activityArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },
  activityIconCardio: { backgroundColor: "rgba(61,122,82,0.18)" },
  activityArrowCardio: { backgroundColor: colors.accentGreen },

  empty: { alignItems: "center", padding: spacing.xxl, gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  emptyBtn: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.brand, borderRadius: radius.md },
  emptyBtnText: { color: colors.textInverse, fontWeight: "800", fontSize: 13 },
});
