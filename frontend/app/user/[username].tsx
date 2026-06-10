import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { ShareToChatSheet, SharePayload } from "@/src/components/ShareToChatSheet";
import { fmtDuration, fmtVolume, fmtDate } from "@/src/utils/format";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  const load = useCallback(async () => {
    try {
      const u = await api<{ user: any }>(`/users/${username}`);
      setProfile(u.user);
      if (!u.user.is_private || u.user.is_following || u.user.is_self) {
        const w = await api<{ workouts: any[] }>(`/workouts/user/${u.user.user_id}`);
        setWorkouts(w.workouts);
      } else {
        setWorkouts([]);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onFollow = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.is_following) {
        await api(`/users/${profile.user_id}/follow`, { method: "DELETE" });
      } else if (profile.follow_pending) {
        await api(`/users/${profile.user_id}/follow`, { method: "DELETE" });
      } else {
        await api(`/users/${profile.user_id}/follow`, { method: "POST" });
      }
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const onMessage = async () => {
    if (!profile) return;
    try {
      const r = await api<{ conversation_id: string }>("/conversations/start", {
        method: "POST",
        body: JSON.stringify({ user_id: profile.user_id }),
      });
      router.push(`/chats/${r.conversation_id}`);
    } catch (e: any) { Alert.alert("Failed", e.message); }
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 64 }} />
      </SafeAreaView>
    );
  }

  const followLabel = profile.is_following ? "Following" : profile.follow_pending ? "Requested" : "Follow";
  const followStyle = profile.is_following || profile.follow_pending ? styles.followBtnFollowing : styles.followBtnPrimary;
  const followTextStyle = profile.is_following || profile.follow_pending ? styles.followTextFollowing : styles.followTextPrimary;
  const canView = !profile.is_private || profile.is_following || profile.is_self;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="user-profile-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{profile.username}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.hero}>
          <Avatar uri={profile.profile_picture} name={profile.display_name} size={84} />
          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          {profile.currently_working_out ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>WORKING OUT</Text>
            </View>
          ) : null}
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{profile.workouts_count || 0}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>
            <TouchableOpacity testID="stat-followers" style={styles.statBlock} onPress={() => !profile.hide_followers && router.push(`/followers/${profile.user_id}?tab=followers`)}>
              <Text style={styles.statValue}>{profile.followers_count || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="stat-following" style={styles.statBlock} onPress={() => !profile.hide_followers && router.push(`/followers/${profile.user_id}?tab=following`)}>
              <Text style={styles.statValue}>{profile.following_count || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          {!profile.is_self ? (
            <View style={styles.actions}>
              <TouchableOpacity
                testID="follow-btn"
                style={[styles.btn, followStyle]}
                onPress={onFollow}
                disabled={busy}
              >
                <Text style={followTextStyle}>{followLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="message-btn" style={[styles.btn, styles.followBtnFollowing]} onPress={onMessage}>
                <Text style={styles.followTextFollowing}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="share-profile-btn"
                style={[styles.btn, styles.followBtnFollowing, { flex: 0, paddingHorizontal: 12 }]}
                onPress={() => {
                  setSharePayload({ kind: "profile", user_id: profile.user_id });
                  setShareOpen(true);
                }}
              >
                <Ionicons name="paper-plane-outline" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {!canView ? (
          <View style={styles.privateBox}>
            <Ionicons name="lock-closed" size={32} color={colors.textMuted} />
            <Text style={styles.privateTitle}>This account is private</Text>
            <Text style={styles.privateSubtitle}>Follow to see their workouts</Text>
          </View>
        ) : (
          <>
            <Text style={styles.section}>Workouts</Text>
            {workouts.length === 0 ? (
              <Text style={styles.noWorkouts}>No workouts yet</Text>
            ) : workouts.map((w) => (
              <TouchableOpacity
                key={w.workout_id}
                testID={`user-workout-${w.workout_id}`}
                style={styles.workoutItem}
                onPress={() => router.push(`/workout/${w.workout_id}`)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.workoutName}>{w.name}</Text>
                  <Text style={styles.workoutMeta}>{fmtDate(w.started_at)} · {fmtDuration(w.duration_seconds)} · {fmtVolume(w.total_volume || 0, me?.weight_unit || "kg")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
      <ShareToChatSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        payload={sharePayload}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  hero: { alignItems: "center", padding: spacing.lg },
  name: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: spacing.md, letterSpacing: -0.3 },
  username: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  bio: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.sm, textAlign: "center", paddingHorizontal: 24 },
  liveBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(192,64,64,0.14)", borderWidth: 1, borderColor: "rgba(192,64,64,0.30)", borderRadius: radius.full, marginTop: spacing.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger, marginRight: 6 },
  liveText: { color: colors.danger, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  statsRow: { flexDirection: "row", marginTop: spacing.lg },
  statBlock: { paddingHorizontal: 20, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "900", color: colors.text },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 2 },
  actions: { flexDirection: "row", marginTop: spacing.lg, gap: 8, width: "100%", paddingHorizontal: 24 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: "center" },
  followBtnPrimary: { backgroundColor: colors.brand },
  followTextPrimary: { color: "#fff", fontWeight: "800", fontSize: 13 },
  followBtnFollowing: { backgroundColor: colors.bg3 },
  followTextFollowing: { color: colors.text, fontWeight: "700", fontSize: 13 },
  section: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: colors.textMuted, padding: spacing.md, textTransform: "uppercase", borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.md },
  noWorkouts: { color: colors.textMuted, padding: spacing.md, fontStyle: "italic" },
  workoutItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  workoutName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  workoutMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  privateBox: { alignItems: "center", padding: spacing.xl, marginTop: spacing.md },
  privateTitle: { color: colors.text, fontWeight: "800", marginTop: 12, fontSize: 15 },
  privateSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
});
