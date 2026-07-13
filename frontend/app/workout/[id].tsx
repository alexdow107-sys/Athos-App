import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { ShareToChatSheet, SharePayload } from "@/src/components/ShareToChatSheet";
import { fmtDuration, fmtVolume, fmtDate, fmtRelative } from "@/src/utils/format";

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<any>(`/workouts/${id}`);
      setData(r);
      // Look up post for this workout via dedicated endpoint (cheap)
      try {
        const pr = await api<{ post: any }>(`/posts/by-workout/${id}`);
        if (pr.post) {
          setPostId(pr.post.post_id);
          const c = await api<{ comments: any[] }>(`/posts/${pr.post.post_id}/comments`);
          setComments(c.comments);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onComment = async () => {
    if (!commentText.trim() || !postId) return;
    setPosting(true);
    try {
      const r = await api<{ comment: any }>(`/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: commentText.trim() }),
      });
      setComments((prev) => [...prev, r.comment]);
      setCommentText("");
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setPosting(false);
    }
  };

  const onSaveAsRoutine = async () => {
    try {
      await api(`/routines/from-workout/${id}`, { method: "POST" });
      if (Platform.OS === "web") window.alert("Saved to your routines");
      else Alert.alert("Saved", "This workout was saved to your routines.");
    } catch (e: any) {
      const msg = e?.message || "Could not save routine";
      if (Platform.OS === "web") window.alert("Failed: " + msg);
      else Alert.alert("Failed", msg);
    }
  };

  const onDelete = async () => {
    const doDelete = async () => {
      try {
        await api(`/workouts/${id}`, { method: "DELETE" });
        router.replace("/(tabs)/workout" as any);
      } catch (e: any) {
        if (Platform.OS === "web") window.alert("Failed: " + (e.message || "Could not delete"));
        else Alert.alert("Failed", e.message);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete this workout? This cannot be undone.")) doDelete();
      return;
    }
    Alert.alert("Delete workout?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 64 }} />
      </SafeAreaView>
    );
  }

  if (!data?.workout) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 64 }}>Workout not found</Text>
      </SafeAreaView>
    );
  }

  const w = data.workout;
  const owner = data.user;
  const isOwn = user?.user_id === w.user_id;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="workout-detail-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Workout</Text>
          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity
              testID="share-workout-btn"
              onPress={() => {
                setSharePayload({ kind: "workout", workout_id: String(id) });
                setShareOpen(true);
              }}
              style={styles.iconBtn}
            >
              <Ionicons name="paper-plane-outline" size={20} color={colors.brand} />
            </TouchableOpacity>
            {isOwn ? (
              <TouchableOpacity testID="delete-workout-btn" onPress={onDelete} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          {owner && (
            <TouchableOpacity
              testID="workout-owner-row"
              onPress={() => router.push(`/user/${owner.username}`)}
              style={styles.ownerRow}
              activeOpacity={0.7}
            >
              <Avatar uri={owner.profile_picture} name={owner.display_name} size={42} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.ownerName}>{owner.display_name}</Text>
                <Text style={styles.ownerMeta}>@{owner.username} · {fmtRelative(w.started_at)}</Text>
              </View>
            </TouchableOpacity>
          )}

          <Text style={styles.workoutName}>{w.name}</Text>
          <Text style={styles.dateText}>{fmtDate(w.started_at)}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>DURATION</Text>
              <Text style={styles.statValue}>{fmtDuration(w.duration_seconds)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>VOLUME</Text>
              <Text style={styles.statValue}>{fmtVolume(w.total_volume || 0, user?.weight_unit || "kg")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>SETS</Text>
              <Text style={styles.statValue}>{(w.exercises || []).reduce((acc: number, ex: any) => acc + (ex.sets?.filter((s: any) => s.completed).length || 0), 0)}</Text>
            </View>
          </View>

          {w.notes ? <View style={styles.notesBox}><Text style={styles.notesText}>{w.notes}</Text></View> : null}

          {w.prs?.length > 0 && (
            <View style={styles.prSection}>
              <Text style={styles.sectionLabel}>🏆 Personal Records</Text>
              {w.prs.map((pr: any, i: number) => (
                <View key={i} style={styles.prRow}>
                  <Text style={styles.prName}>{pr.exercise_name}</Text>
                  <Text style={styles.prValue}>{Math.round(pr.estimated_1rm)} {user?.weight_unit || "kg"} est. 1RM</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionLabel}>Exercises</Text>
          {(w.exercises || []).map((ex: any, idx: number) => (
            <View key={idx} style={styles.exerciseBlock} testID={`detail-exercise-${idx}`}>
              <Text style={styles.exName}>{ex.exercise_name}</Text>
              {ex.machine ? <Text style={styles.exMeta}>{ex.machine}</Text> : null}
              {(ex.sets || []).filter((s: any) => s.completed).map((s: any, si: number) => (
                <View key={si} style={styles.setRow}>
                  <Text style={styles.setNum}>{si + 1}</Text>
                  {ex.is_unilateral ? (
                    <Text style={styles.setText}>L {s.left_weight} × {s.left_reps} · R {s.right_weight} × {s.right_reps}</Text>
                  ) : (
                    <Text style={styles.setText}>{s.weight} {user?.weight_unit || "kg"} × {s.reps} reps</Text>
                  )}
                </View>
              ))}
            </View>
          ))}

          {isOwn && (w.exercises || []).length > 0 && (
            <TouchableOpacity testID="save-as-routine-btn" style={styles.routineBtn} onPress={onSaveAsRoutine} activeOpacity={0.8}>
              <Ionicons name="repeat" size={17} color={colors.brand} />
              <Text style={styles.routineBtnText}>Save as routine</Text>
            </TouchableOpacity>
          )}

          {postId && (
            <View>
              <Text style={styles.sectionLabel}>Comments</Text>
              {comments.length === 0 && <Text style={styles.noComments}>No comments yet</Text>}
              {comments.map((c) => (
                <View key={c.comment_id} style={styles.commentRow}>
                  <Avatar uri={c.user?.profile_picture} name={c.user?.display_name} size={32} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.commentUser}>{c.user?.display_name || "User"}</Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                    <Text style={styles.commentTime}>{fmtRelative(c.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {postId && (
          <View style={styles.commentBox}>
            <TextInput
              testID="comment-input"
              value={commentText} onChangeText={setCommentText}
              placeholder="Add a comment..." placeholderTextColor={colors.textMuted}
              style={styles.commentInput}
            />
            <TouchableOpacity testID="post-comment-btn" onPress={onComment} disabled={posting || !commentText.trim()} style={styles.postBtn}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
  ownerRow: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  ownerName: { color: colors.text, fontWeight: "800", fontSize: 14 },
  ownerMeta: { color: colors.textMuted, fontSize: 12 },
  workoutName: { color: colors.text, fontSize: 26, fontWeight: "900", paddingHorizontal: spacing.md, letterSpacing: -0.5 },
  dateText: { color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.md, marginTop: 2 },
  statsRow: { flexDirection: "row", margin: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.lg, padding: spacing.md, alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  notesBox: { marginHorizontal: spacing.md, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.lg },
  notesText: { color: colors.textSecondary, fontSize: 13 },
  prSection: { marginHorizontal: spacing.md, marginTop: spacing.md, padding: spacing.md, backgroundColor: "rgba(200,154,58,0.10)", borderWidth: 1, borderColor: "rgba(200,154,58,0.30)", borderRadius: radius.lg },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1.2, paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: 8, textTransform: "uppercase" },
  prRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  prName: { color: colors.text, fontWeight: "700" },
  prValue: { color: colors.pr, fontWeight: "800" },
  exerciseBlock: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  routineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: spacing.md, marginTop: spacing.lg, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandLight },
  routineBtnText: { color: colors.brand, fontWeight: "800", fontSize: 14 },
  exName: { color: colors.brand, fontSize: 15, fontWeight: "800" },
  exMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  setRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  setNum: { color: colors.textMuted, width: 24, fontWeight: "700" },
  setText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  noComments: { color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.md, fontStyle: "italic" },
  commentRow: { flexDirection: "row", paddingHorizontal: spacing.md, paddingVertical: 8 },
  commentUser: { color: colors.text, fontWeight: "700", fontSize: 13 },
  commentText: { color: colors.text, fontSize: 13, marginTop: 2 },
  commentTime: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  commentBox: { flexDirection: "row", padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, alignItems: "center", gap: 8 },
  commentInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text },
  postBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
