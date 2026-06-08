import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { fmtDuration, fmtVolume, fmtRelative } from "@/src/utils/format";
import { useAuth } from "@/src/context/AuthContext";

interface Post {
  post_id: string; user_id: string; workout_id: string; name: string;
  duration_seconds: number; total_volume: number; exercise_count: number;
  prs?: any[]; likes_count: number; comments_count: number; created_at: string;
  user?: any; liked: boolean; saved: boolean;
}

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<"following" | "explore">("following");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const load = useCallback(async () => {
    try {
      const path = tab === "following" ? "/feed" : "/feed/explore";
      const r = await api<{ posts: Post[] }>(path);
      setPosts(r.posts);
      const m = await api<{ count: number }>("/conversations/unread-count").catch(() => ({ count: 0 }));
      setUnreadMessages(m.count);
    } catch (e: any) {
      console.warn(e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onLike = async (p: Post) => {
    const newLiked = !p.liked;
    setPosts((prev) => prev.map((x) => x.post_id === p.post_id ? { ...x, liked: newLiked, likes_count: x.likes_count + (newLiked ? 1 : -1) } : x));
    try {
      if (newLiked) await api(`/posts/${p.post_id}/like`, { method: "POST" });
      else await api(`/posts/${p.post_id}/like`, { method: "DELETE" });
    } catch {
      load();
    }
  };

  const onSave = async (p: Post) => {
    const newSaved = !p.saved;
    setPosts((prev) => prev.map((x) => x.post_id === p.post_id ? { ...x, saved: newSaved } : x));
    try {
      if (newSaved) await api(`/posts/${p.post_id}/save`, { method: "POST" });
      else await api(`/posts/${p.post_id}/save`, { method: "DELETE" });
    } catch { load(); }
  };

  const renderPost = ({ item: p }: { item: Post }) => {
    const u = p.user;
    return (
      <View testID={`post-${p.post_id}`} style={styles.post}>
        <TouchableOpacity
          style={styles.postHeader}
          activeOpacity={0.7}
          onPress={() => u && router.push(`/user/${u.username}`)}
          testID={`post-user-${p.post_id}`}
        >
          <Avatar uri={u?.profile_picture} name={u?.display_name} size={40} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.postUser}>{u?.display_name || "User"}</Text>
            <Text style={styles.postMeta}>
              @{u?.username || "user"} · {fmtRelative(p.created_at)}
              {u?.currently_working_out ? " · 🔴 Live" : ""}
            </Text>
          </View>
          {p.prs && p.prs.length > 0 && (
            <View style={styles.prBadge}>
              <Ionicons name="trophy" size={12} color={colors.pr} />
              <Text style={styles.prText}>{p.prs.length} PR</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(`/workout/${p.workout_id}`)}
          testID={`post-workout-${p.post_id}`}
        >
          <Text style={styles.workoutName}>{p.name}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>DURATION</Text>
              <Text style={styles.statValue}>{fmtDuration(p.duration_seconds)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>VOLUME</Text>
              <Text style={styles.statValue}>{fmtVolume(p.total_volume, user?.weight_unit || "kg")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>EXERCISES</Text>
              <Text style={styles.statValue}>{p.exercise_count}</Text>
            </View>
          </View>

          {p.prs && p.prs.length > 0 && (
            <View style={styles.prContainer}>
              {p.prs.slice(0, 3).map((pr: any, i: number) => (
                <View key={i} style={styles.prPill}>
                  <Ionicons name="trophy" size={11} color={colors.pr} />
                  <Text style={styles.prPillText}>{pr.exercise_name}: {Math.round(pr.estimated_1rm)} {user?.weight_unit || "kg"}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity testID={`like-${p.post_id}`} onPress={() => onLike(p)} style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name={p.liked ? "heart" : "heart-outline"} size={22} color={p.liked ? colors.danger : colors.text} />
            <Text style={styles.actionText}>{p.likes_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`comment-${p.post_id}`}
            onPress={() => router.push(`/workout/${p.workout_id}`)}
            style={styles.actionBtn} activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
            <Text style={styles.actionText}>{p.comments_count}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity testID={`save-${p.post_id}`} onPress={() => onSave(p)} style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name={p.saved ? "bookmark" : "bookmark-outline"} size={20} color={p.saved ? colors.brand : colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} testID="feed-screen" edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="header-coach" onPress={() => router.push("/coach")} style={styles.notifBtn}>
          <Ionicons name="ribbon-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appName}>Athos</Text>
        <TouchableOpacity testID="header-messages" onPress={() => router.push("/chats")} style={styles.notifBtn}>
          <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
          {unreadMessages > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadMessages > 99 ? "99+" : unreadMessages}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          testID="feed-tab-following"
          onPress={() => setTab("following")}
          style={[styles.tabBtn, tab === "following" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "following" && styles.tabTextActive]}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="feed-tab-explore"
          onPress={() => setTab("explore")}
          style={[styles.tabBtn, tab === "explore" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "explore" && styles.tabTextActive]}>Explore</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          testID="feed-list"
          data={posts}
          renderItem={renderPost}
          keyExtractor={(p) => p.post_id}
          contentContainerStyle={posts.length === 0 ? styles.empty : { paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.emptyContent}>
              <Ionicons name="barbell" size={56} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{tab === "following" ? "Your feed is empty" : "No workouts yet"}</Text>
              <Text style={styles.emptySubtitle}>
                {tab === "following"
                  ? "Follow athletes from Discover to see their workouts here"
                  : "Be the first to log a workout"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: "space-between" },
  appName: { fontSize: 24, fontWeight: "900", color: colors.brand, letterSpacing: -1 },
  notifBtn: { padding: 6, position: "relative" },
  notifDot: { position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  badge: {
    position: "absolute", top: 0, right: 0,
    backgroundColor: colors.danger, minWidth: 16, height: 16, paddingHorizontal: 4,
    borderRadius: 8, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tabBtn: { paddingVertical: 10, marginRight: spacing.lg },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  tabText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.text, fontWeight: "800" },
  post: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  postUser: { fontWeight: "700", color: colors.text, fontSize: 14 },
  postMeta: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  prBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  prText: { color: colors.pr, fontSize: 11, fontWeight: "800", marginLeft: 4 },
  workoutName: { fontSize: 17, fontWeight: "800", color: colors.text, marginBottom: spacing.sm },
  statsRow: { flexDirection: "row", backgroundColor: colors.bg2, borderRadius: radius.lg, padding: spacing.md, alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  prContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm },
  prPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, marginRight: 6, marginTop: 4 },
  prPillText: { color: colors.pr, fontSize: 11, fontWeight: "700", marginLeft: 4 },
  actions: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: spacing.lg },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyContent: { alignItems: "center", padding: spacing.xl },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: spacing.md },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: "center" },
});
