import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Dimensions, ScrollView, Alert, Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { fmtDuration, fmtVolume, fmtRelative, fmtDistance } from "@/src/utils/format";
import { useAuth } from "@/src/context/AuthContext";

const { width: SW } = Dimensions.get("window");

// Feed uses a true-black surface palette
const BLACK = "#000000";
const CARD  = "#111111";
const CARD2 = "#181818";
const LINE  = "#222222";

interface Post {
  post_id: string; user_id: string; workout_id: string; name: string;
  duration_seconds: number; total_volume: number; exercise_count: number;
  prs?: any[]; likes_count: number; comments_count: number; created_at: string;
  user?: any; liked: boolean; saved: boolean;
  caption?: string; photos?: string[]; visibility?: "public" | "private";
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<"following" | "explore">("following");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const path = tab === "following" ? "/feed" : "/feed/explore";
      const r = await api<{ posts: Post[] }>(path);
      setPosts(r.posts);
      const m = await api<{ count: number }>("/conversations/unread-count").catch(() => ({ count: 0 }));
      setUnread(m.count);
    } catch (e: any) {
      console.warn(e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onLike = async (p: Post) => {
    const liked = !p.liked;
    setPosts(prev => prev.map(x => x.post_id === p.post_id
      ? { ...x, liked, likes_count: x.likes_count + (liked ? 1 : -1) } : x));
    try {
      if (liked) await api(`/posts/${p.post_id}/like`, { method: "POST" });
      else await api(`/posts/${p.post_id}/like`, { method: "DELETE" });
    } catch { load(); }
  };

  const onDeletePost = (p: Post) => {
    const doDelete = async () => {
      try {
        await api(`/workouts/${p.workout_id}`, { method: "DELETE" });
        setPosts(prev => prev.filter(x => x.post_id !== p.post_id));
      } catch {}
    };
    if (Platform.OS === "web") {
      if (window.confirm("Delete this workout and post? This cannot be undone.")) doDelete();
      return;
    }
    Alert.alert("Delete workout?", "This will delete the workout and its post. Cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  const onSave = async (p: Post) => {
    const saved = !p.saved;
    setPosts(prev => prev.map(x => x.post_id === p.post_id ? { ...x, saved } : x));
    try {
      if (saved) await api(`/posts/${p.post_id}/save`, { method: "POST" });
      else await api(`/posts/${p.post_id}/save`, { method: "DELETE" });
    } catch { load(); }
  };

  const storyUsers = React.useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const p of posts) {
      if (p.user && !seen.has(p.user.user_id)) {
        seen.add(p.user.user_id);
        out.push(p.user);
        if (out.length >= 10) break;
      }
    }
    return out;
  }, [posts]);

  const renderPost = ({ item: p }: { item: Post }) => {
    const u = p.user;
    const hasPhotos = p.photos && p.photos.length > 0;

    if (p.visibility === "private") {
      return (
        <View style={styles.card}>
          <TouchableOpacity style={styles.postHeader} activeOpacity={0.7}
            onPress={() => u && router.push(`/user/${u.username}`)}>
            <View style={styles.avatarRing}>
              <Avatar uri={u?.profile_picture} name={u?.display_name} size={40} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.postUser}>{u?.display_name || "User"}</Text>
              <Text style={styles.postTime}>{fmtRelative(p.created_at)}</Text>
            </View>
            <View style={styles.privateTag}>
              <Ionicons name="lock-closed" size={10} color="#666" />
              <Text style={styles.privateTagText}>Private</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.privateBody}>
            <Ionicons name="barbell-outline" size={13} color="#555" />
            <Text style={styles.privateName}>{p.name}</Text>
          </View>
        </View>
      );
    }

    const distanceKm = (p as any).distance_km;
    const hasDistance = distanceKm != null;
    const weightUnit = user?.weight_unit || "kg";
    const distUnit = (user?.distance_unit as any) || "km";

    return (
      <View style={styles.card}>
        {/* Header */}
        <TouchableOpacity style={styles.postHeader} activeOpacity={0.8}
          onPress={() => u && router.push(`/user/${u.username}`)}>
          <View style={styles.avatarRing}>
            <Avatar uri={u?.profile_picture} name={u?.display_name} size={40} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.postUser}>{u?.display_name || "User"}</Text>
              {u?.currently_working_out && (
                <View style={styles.liveTag}>
                  <Text style={styles.liveTagText}>LIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.postTime}>{fmtRelative(p.created_at)}</Text>
          </View>
          {p.user_id === user?.user_id
            ? <TouchableOpacity onPress={() => onDeletePost(p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={18} color="#C04040" />
              </TouchableOpacity>
            : <Ionicons name="ellipsis-horizontal" size={18} color="#555" />
          }
        </TouchableOpacity>

        {/* Workout name + caption */}
        <TouchableOpacity style={styles.postBody} activeOpacity={0.8}
          onPress={() => router.push(`/workout/${p.workout_id}`)}>
          <Text style={styles.workoutTitle}>{p.name}</Text>
          {p.caption ? <Text style={styles.caption}>{p.caption}</Text> : null}
          {p.prs && p.prs.length > 0 && (
            <View style={styles.prBadge}>
              <Ionicons name="trophy" size={12} color="#C89A3A" />
              <Text style={styles.prBadgeText}>{p.prs.length} PR{p.prs.length > 1 ? "s" : ""}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Stats row — Strava-style: label over bold value */}
        <TouchableOpacity style={styles.statsRow} activeOpacity={0.8}
          onPress={() => router.push(`/workout/${p.workout_id}`)}>
          <StatBlock label="Time" value={fmtDuration(p.duration_seconds)} />
          {hasDistance ? (
            <>
              <View style={styles.statDivider} />
              <StatBlock label="Distance" value={fmtDistance(distanceKm, distUnit)} />
            </>
          ) : p.exercise_count > 0 ? (
            <>
              <View style={styles.statDivider} />
              <StatBlock label="Exercises" value={String(p.exercise_count)} />
            </>
          ) : null}
          {p.total_volume > 0 && (
            <>
              <View style={styles.statDivider} />
              <StatBlock label="Volume" value={fmtVolume(p.total_volume, weightUnit)} />
            </>
          )}
        </TouchableOpacity>

        {/* Photos — full width, edge to edge */}
        {hasPhotos && (
          <TouchableOpacity activeOpacity={0.93}
            onPress={() => router.push(`/workout/${p.workout_id}`)}>
            {p.photos!.length === 1 ? (
              <Image
                source={{ uri: p.photos![0] }}
                style={styles.photoSingle}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.photoDuo}>
                {p.photos!.slice(0, 2).map((src, i) => (
                  <Image key={i} source={{ uri: src }} style={styles.photoDuoThumb} resizeMode="cover" />
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity testID={`like-${p.post_id}`} onPress={() => onLike(p)} style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name={p.liked ? "heart" : "heart-outline"} size={23} color={p.liked ? colors.brand : "#666"} />
            {p.likes_count > 0 && (
              <Text style={[styles.actionCount, p.liked && { color: colors.brand }]}>{p.likes_count}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity testID={`comment-${p.post_id}`} style={styles.actionBtn} activeOpacity={0.7}
            onPress={() => router.push(`/workout/${p.workout_id}`)}>
            <Ionicons name="chatbubble-outline" size={21} color="#666" />
            {p.comments_count > 0 && <Text style={styles.actionCount}>{p.comments_count}</Text>}
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity testID={`save-${p.post_id}`} onPress={() => onSave(p)} style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name={p.saved ? "bookmark" : "bookmark-outline"} size={21}
              color={p.saved ? colors.brand : "#666"} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ListHeader = () => (
    <>
      {storyUsers.length > 0 && (
        <View style={styles.storiesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesInner}>
            {storyUsers.map((u) => (
              <TouchableOpacity key={u.user_id} style={styles.storyItem} activeOpacity={0.8}
                onPress={() => router.push(`/user/${u.username}`)}>
                <View style={styles.storyRing}>
                  <Avatar uri={u.profile_picture} name={u.display_name} size={50} />
                </View>
                <Text style={styles.storyName} numberOfLines={1}>{u.display_name?.split(" ")[0]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} testID="feed-screen" edges={["top"]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.appName}>Athos</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {(["following", "explore"] as const).map((t) => (
            <TouchableOpacity key={t} testID={`feed-tab-${t}`} onPress={() => setTab(t)}
              style={[styles.tabChip, tab === t && styles.tabChipActive]} activeOpacity={0.7}>
              <Text style={[styles.tabChipText, tab === t && styles.tabChipTextActive]}>
                {t === "following" ? "Following" : "Explore"}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity testID="header-messages" onPress={() => router.push("/chats")} style={styles.iconBtn}>
            <Ionicons name="paper-plane-outline" size={20} color="#ccc" />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: BLACK }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          testID="feed-list"
          data={posts}
          renderItem={renderPost}
          keyExtractor={(p) => p.post_id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={posts.length === 0 ? styles.emptyWrap : { paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          style={{ backgroundColor: BLACK }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand}
            onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.emptyContent}>
              <Ionicons name="barbell-outline" size={44} color="#333" />
              <Text style={styles.emptyTitle}>
                {tab === "following" ? "Your feed is empty" : "No workouts yet"}
              </Text>
              <Text style={styles.emptySub}>
                {tab === "following"
                  ? "Follow athletes from Discover to see their workouts"
                  : "Be the first to log a workout"}
              </Text>
              <TouchableOpacity
                testID="empty-cta"
                style={styles.emptyBtn}
                activeOpacity={0.85}
                onPress={() => router.push(tab === "following" ? "/(tabs)/discover" : "/(tabs)/workout")}
              >
                <Ionicons
                  name={tab === "following" ? "compass-outline" : "add"}
                  size={16}
                  color={colors.textInverse}
                />
                <Text style={styles.emptyBtnText}>
                  {tab === "following" ? "Find athletes" : "Start a workout"}
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BLACK },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: 10,
    backgroundColor: BLACK, borderBottomWidth: 1, borderBottomColor: LINE,
  },
  appName: { fontSize: 22, fontWeight: "900", color: colors.brand, letterSpacing: -0.5 },
  tabChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: "transparent",
  },
  tabChipActive: { backgroundColor: "rgba(107,197,222,0.12)" },
  tabChipText: { fontSize: 13, fontWeight: "600", color: "#555" },
  tabChipTextActive: { color: colors.brand, fontWeight: "800" },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  badge: {
    position: "absolute", top: 2, right: 2, backgroundColor: colors.brand,
    minWidth: 14, height: 14, paddingHorizontal: 2, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  storiesWrap: { backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: LINE },
  storiesInner: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md },
  storyItem: { alignItems: "center", width: 62 },
  storyRing: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 2, borderColor: colors.brand,
    padding: 2, marginBottom: 5,
  },
  storyName: { fontSize: 11, color: "#888", fontWeight: "600", textAlign: "center" },

  sep: { height: 1, backgroundColor: LINE },
  card: { backgroundColor: CARD },

  postHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 10,
  },
  avatarRing: {
    borderRadius: 24, borderWidth: 1.5, borderColor: colors.brand, padding: 1.5,
  },
  postUser: { fontSize: 15, fontWeight: "800", color: "#F0F0F0" },
  postTime: { fontSize: 12, color: "#555", marginTop: 1 },
  liveTag: {
    backgroundColor: colors.brand, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: radius.sm,
  },
  liveTagText: { color: "#000", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  postBody: { paddingHorizontal: spacing.md, paddingBottom: 12 },
  workoutTitle: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", letterSpacing: -0.4, lineHeight: 26 },
  caption: { color: "#888", fontSize: 13, marginTop: 5, lineHeight: 19 },
  prBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 8, alignSelf: "flex-start",
    backgroundColor: "rgba(200,154,58,0.12)", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full,
  },
  prBadgeText: { color: "#C89A3A", fontSize: 12, fontWeight: "800" },

  statsRow: {
    flexDirection: "row", alignItems: "stretch",
    marginHorizontal: spacing.md, marginBottom: 12,
    backgroundColor: CARD2, borderRadius: radius.lg,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: LINE,
  },
  statBlock: { flex: 1, alignItems: "flex-start" },
  statDivider: { width: 1, backgroundColor: LINE, marginHorizontal: 2 },
  statLabel: { fontSize: 11, fontWeight: "700", color: "#555", letterSpacing: 0.5, marginBottom: 3, textTransform: "uppercase" },
  statValue: { fontSize: 18, fontWeight: "900", color: "#FFFFFF", letterSpacing: -0.3 },

  photoSingle: { width: SW, height: SW * 0.6 },
  photoDuo: { flexDirection: "row", gap: 2 },
  photoDuoThumb: { flex: 1, height: SW * 0.5 },

  actions: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: LINE,
    gap: spacing.lg,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { color: "#666", fontSize: 14, fontWeight: "700" },

  privateTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, backgroundColor: CARD2,
  },
  privateTagText: { color: "#555", fontSize: 11, fontWeight: "700" },
  privateBody: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingLeft: 60,
  },
  privateName: { color: "#555", fontSize: 14, fontWeight: "600" },

  emptyWrap: { flex: 1, backgroundColor: BLACK },
  emptyContent: { alignItems: "center", padding: spacing.xxl, paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#F0F0F0" },
  emptySub: { fontSize: 13, color: "#555", textAlign: "center", lineHeight: 19 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.full,
    backgroundColor: colors.brand,
  },
  emptyBtnText: { color: colors.textInverse, fontWeight: "800", fontSize: 14 },
});
