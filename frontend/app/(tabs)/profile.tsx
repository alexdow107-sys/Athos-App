import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, FlatList } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { fmtDuration, fmtVolume, fmtDate } from "@/src/utils/format";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api<{ workouts: any[] }>(`/workouts/user/${user.user_id}?limit=50`);
      setWorkouts(r.workouts);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); refresh(); load(); }, [load, refresh]));

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 64 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="profile-screen" edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity testID="goto-analytics-btn" onPress={() => router.push("/analytics")}>
            <Ionicons name="stats-chart-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity testID="goto-settings-btn" onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={workouts}
        keyExtractor={(w) => w.workout_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); refresh(); }} />}
        ListHeaderComponent={
          <View>
            <View style={styles.profileHero}>
              <Avatar uri={user.profile_picture} name={user.display_name} size={84} />
              <Text style={styles.displayName}>{user.display_name}</Text>
              <Text style={styles.username}>@{user.username}</Text>
              {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
              {user.is_premium ? (
                <View style={styles.proBadge}>
                  <Ionicons name="star" size={12} color={colors.pr} />
                  <Text style={styles.proText}>ATHO PREMIUM</Text>
                </View>
              ) : null}
              <View style={styles.statsRow}>
                <TouchableOpacity testID="stat-workouts" style={styles.statBlock}>
                  <Text style={styles.statValue}>{user.workouts_count || 0}</Text>
                  <Text style={styles.statLabel}>Workouts</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="stat-followers" style={styles.statBlock} onPress={() => router.push(`/followers/${user.user_id}?tab=followers`)}>
                  <Text style={styles.statValue}>{user.followers_count || 0}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="stat-following" style={styles.statBlock} onPress={() => router.push(`/followers/${user.user_id}?tab=following`)}>
                  <Text style={styles.statValue}>{user.following_count || 0}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity testID="edit-profile-btn" style={[styles.btn, styles.btnSecondary]} onPress={() => router.push("/settings")}>
                  <Text style={styles.btnSecondaryText}>Edit profile</Text>
                </TouchableOpacity>
                {!user.is_premium && (
                  <TouchableOpacity testID="goto-premium-btn" style={[styles.btn, styles.btnPremium]} onPress={() => router.push("/subscription")}>
                    <Ionicons name="star" size={14} color="#fff" />
                    <Text style={styles.btnPremiumText}>  Upgrade to Premium</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.section}>Recent workouts</Text>
              <TouchableOpacity testID="view-calendar-btn" onPress={() => router.push("/calendar")}>
                <Text style={styles.sectionLink}>Calendar</Text>
              </TouchableOpacity>
            </View>
            {loading && <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />}
          </View>
        }
        renderItem={({ item: w }) => (
          <TouchableOpacity
            testID={`profile-workout-${w.workout_id}`}
            activeOpacity={0.7}
            style={styles.workoutItem}
            onPress={() => router.push(`/workout/${w.workout_id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.workoutName}>{w.name}</Text>
              <Text style={styles.workoutMeta}>{fmtDate(w.started_at)} · {fmtDuration(w.duration_seconds)} · {fmtVolume(w.total_volume || 0, user.weight_unit || "kg")}</Text>
              <Text style={styles.workoutMeta}>{w.exercises?.length || 0} exercise{(w.exercises?.length || 0) !== 1 ? "s" : ""}{w.prs?.length ? ` · 🏆 ${w.prs.length} PR` : ""}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <TouchableOpacity testID="empty-start-btn" onPress={() => router.push("/(tabs)/workout")} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Start your first workout</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        contentContainerStyle={{ paddingBottom: 48 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", padding: spacing.md, alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  profileHero: { alignItems: "center", padding: spacing.lg, paddingTop: spacing.md },
  displayName: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: spacing.md, letterSpacing: -0.3 },
  username: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  bio: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.sm, textAlign: "center", paddingHorizontal: 24 },
  proBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#FEF3C7", borderRadius: radius.full, marginTop: spacing.sm },
  proText: { color: colors.pr, fontSize: 10, fontWeight: "900", marginLeft: 4, letterSpacing: 0.5 },
  statsRow: { flexDirection: "row", marginTop: spacing.lg, gap: 8 },
  statBlock: { paddingHorizontal: 20, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: colors.text },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 2, letterSpacing: 0.5 },
  btnRow: { flexDirection: "row", marginTop: spacing.lg, gap: 8, width: "100%", paddingHorizontal: 24 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  btnSecondary: { backgroundColor: colors.bg3 },
  btnSecondaryText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  btnPremium: { backgroundColor: colors.brand },
  btnPremiumText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  section: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: colors.textMuted, textTransform: "uppercase" },
  sectionLink: { fontSize: 12, fontWeight: "700", color: colors.brand },
  workoutItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  workoutName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  workoutMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", padding: spacing.xl, paddingTop: spacing.xxl },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
  emptyBtn: { marginTop: spacing.md, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.brand, borderRadius: radius.md },
  emptyBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
