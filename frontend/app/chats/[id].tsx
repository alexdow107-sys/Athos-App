import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Pressable, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Avatar } from "@/src/components/Avatar";
import { colors, radius, spacing } from "@/src/theme";

type AttachMode = null | "workout" | "profile";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [conv, setConv] = useState<any>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);

  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachMode, setAttachMode] = useState<AttachMode>(null);
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: any[] }>(`/conversations/${id}/messages`);
      setMessages(r.messages);
      // Get conversation meta (for other user info) from list endpoint
      if (!conv) {
        try {
          const list = await api<{ conversations: any[] }>(`/conversations`);
          const c = list.conversations.find((x: any) => x.conversation_id === id);
          if (c) setConv(c);
        } catch {}
      }
    } finally { setLoading(false); }
  }, [id, conv]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 5000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  const send = async (body: any) => {
    setSending(true);
    try {
      const r = await api<{ message: any }>(`/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessages((prev) => [...prev, r.message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally { setSending(false); }
  };

  const onSendText = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();
    setText("");
    try {
      await send({ text: body });
    } catch {
      setText(body);
    }
  };

  const openPicker = async (mode: AttachMode) => {
    setAttachMenuOpen(false);
    setAttachMode(mode);
    setPickerLoading(true);
    try {
      if (mode === "workout" && user) {
        const r = await api<{ workouts: any[] }>(`/workouts/user/${user.user_id}?limit=20`);
        setPickerItems(r.workouts || []);
      } else if (mode === "profile") {
        // Show followed people; fall back to suggestions
        try {
          const r = await api<{ users: any[] }>(`/users/${user?.user_id}/following`);
          setPickerItems(r.users || []);
        } catch {
          setPickerItems([]);
        }
      }
    } finally {
      setPickerLoading(false);
    }
  };

  const pickItem = async (item: any) => {
    if (attachMode === "workout") {
      await send({ shared_workout_id: item.workout_id, text: "" });
    } else if (attachMode === "profile") {
      await send({ shared_user_id: item.user_id, text: "" });
    }
    setAttachMode(null);
    setPickerItems([]);
  };

  const other = conv?.other_user;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="chat-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          {other ? (
            <TouchableOpacity
              onPress={() => router.push(`/user/${other.username}`)}
              style={styles.headerCenter}
              activeOpacity={0.7}
            >
              <Avatar uri={other.profile_picture} name={other.display_name} size={28} />
              <Text style={styles.headerTitle}>{other.display_name}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.headerTitle}>Chat</Text>
          )}
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.message_id}
            contentContainerStyle={{ padding: spacing.md, paddingBottom: 16 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item: m }) => {
              const mine = m.sender_id === user?.user_id;
              return (
                <View testID={`msg-${m.message_id}`} style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                  {m.shared_workout_id ? (
                    <SharedWorkoutCard workoutId={m.shared_workout_id} mine={mine} onOpen={() => router.push(`/workout/${m.shared_workout_id}`)} />
                  ) : m.shared_user_id ? (
                    <SharedUserCard userId={m.shared_user_id} mine={mine} onOpen={(uname: string) => router.push(`/user/${uname}`)} />
                  ) : (
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.text, mine && styles.textMine]}>{m.text}</Text>
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>Send your first message</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity
            testID="msg-attach-btn"
            onPress={() => setAttachMenuOpen(true)}
            style={styles.attachBtn}
            disabled={sending}
          >
            <Ionicons name="add" size={22} color={colors.brand} />
          </TouchableOpacity>
          <TextInput
            testID="msg-input"
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            style={styles.input}
            multiline
          />
          <TouchableOpacity testID="msg-send-btn" onPress={onSendText} disabled={!text.trim() || sending} style={styles.sendBtn}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Attach menu */}
      <Modal visible={attachMenuOpen} transparent animationType="fade" onRequestClose={() => setAttachMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setAttachMenuOpen(false)}>
          <View style={styles.menu}>
            <TouchableOpacity testID="attach-workout" style={styles.menuItem} onPress={() => openPicker("workout")}>
              <Ionicons name="barbell" size={20} color={colors.brand} />
              <Text style={styles.menuText}>Share a workout</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity testID="attach-profile" style={styles.menuItem} onPress={() => openPicker("profile")}>
              <Ionicons name="person-circle" size={20} color={colors.brand} />
              <Text style={styles.menuText}>Share a profile</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Picker */}
      <Modal visible={!!attachMode} animationType="slide" transparent onRequestClose={() => setAttachMode(null)}>
        <View style={styles.pickerBackdrop}>
          <SafeAreaView style={styles.pickerSheet} edges={["bottom"]}>
            <View style={styles.handle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{attachMode === "workout" ? "Choose a workout" : "Choose a profile"}</Text>
              <TouchableOpacity onPress={() => setAttachMode(null)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            {pickerLoading ? (
              <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={pickerItems}
                keyExtractor={(it) => it.workout_id || it.user_id}
                ListEmptyComponent={
                  <Text style={{ color: colors.textMuted, textAlign: "center", padding: 32 }}>
                    {attachMode === "workout" ? "No workouts to share yet." : "Follow someone first to share their profile."}
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    testID={`picker-${item.workout_id || item.user_id}`}
                    onPress={() => pickItem(item)}
                    style={styles.pickerRow}
                    activeOpacity={0.7}
                  >
                    {attachMode === "workout" ? (
                      <>
                        <View style={styles.pickerIcon}>
                          <Ionicons name="barbell" size={18} color={colors.brand} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickerName}>{item.name || "Workout"}</Text>
                          <Text style={styles.pickerSub}>
                            {new Date(item.started_at).toLocaleDateString()} • {(item.exercises?.length || 0)} exercises
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Avatar uri={item.profile_picture} name={item.display_name} size={40} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.pickerName}>{item.display_name}</Text>
                          <Text style={styles.pickerSub}>@{item.username}</Text>
                        </View>
                      </>
                    )}
                    <Ionicons name="paper-plane" size={16} color={colors.brand} />
                  </TouchableOpacity>
                )}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ===== Shared content preview cards ===== */
const SharedWorkoutCard: React.FC<{ workoutId: string; mine: boolean; onOpen: () => void }> = ({ workoutId, mine, onOpen }) => {
  const [w, setW] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await api<any>(`/workouts/${workoutId}`);
        setW(r.workout);
      } catch {}
    })();
  }, [workoutId]);
  return (
    <TouchableOpacity onPress={onOpen} style={[styles.cardBase, mine && styles.cardMine]} activeOpacity={0.85}>
      <View style={[styles.cardIcon, mine && { backgroundColor: "rgba(255,255,255,0.2)" }]}>
        <Ionicons name="barbell" size={18} color={mine ? "#fff" : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardLabel, mine && { color: "rgba(255,255,255,0.85)" }]}>Workout</Text>
        <Text style={[styles.cardTitle, mine && { color: "#fff" }]} numberOfLines={1}>{w?.name || "Loading…"}</Text>
        {w ? (
          <Text style={[styles.cardSub, mine && { color: "rgba(255,255,255,0.8)" }]}>
            {(w.exercises?.length || 0)} exercises • {Math.round((w.duration_seconds || 0) / 60)} min
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={mine ? "#fff" : colors.textMuted} />
    </TouchableOpacity>
  );
};

const SharedUserCard: React.FC<{ userId: string; mine: boolean; onOpen: (username: string) => void }> = ({ userId, mine, onOpen }) => {
  const [u, setU] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        // userId may be id or username; backend exposes /users/{username}
        // try by username first via search
        const r = await api<{ users: any[] }>(`/users/search/q?q=${encodeURIComponent(userId)}`);
        const match = r.users.find((x: any) => x.user_id === userId);
        if (match) setU(match);
      } catch {}
    })();
  }, [userId]);
  return (
    <TouchableOpacity
      onPress={() => u && onOpen(u.username)}
      style={[styles.cardBase, mine && styles.cardMine]}
      activeOpacity={0.85}
      disabled={!u}
    >
      <Avatar uri={u?.profile_picture} name={u?.display_name} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.cardLabel, mine && { color: "rgba(255,255,255,0.85)" }]}>Profile</Text>
        <Text style={[styles.cardTitle, mine && { color: "#fff" }]} numberOfLines={1}>{u?.display_name || "Loading…"}</Text>
        {u ? <Text style={[styles.cardSub, mine && { color: "rgba(255,255,255,0.8)" }]}>@{u.username}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={mine ? "#fff" : colors.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, maxWidth: "80%", marginVertical: 3 },
  bubbleMine: { backgroundColor: colors.brand, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.bg2, alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  text: { color: colors.text, fontSize: 14 },
  textMine: { color: "#fff" },
  inputBar: { flexDirection: "row", padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, alignItems: "flex-end", gap: 6 },
  attachBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brandLight,
  },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 64 },
  emptyText: { color: colors.textMuted, marginTop: 8 },

  cardBase: {
    flexDirection: "row", alignItems: "center", maxWidth: "85%", marginVertical: 4,
    backgroundColor: colors.bg2, padding: 10, borderRadius: 12, gap: 10,
  },
  cardMine: { backgroundColor: colors.brand },
  cardIcon: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  cardLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.textMuted, textTransform: "uppercase" },
  cardTitle: { fontSize: 14, fontWeight: "800", color: colors.text, marginTop: 2 },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end", paddingBottom: 70, paddingHorizontal: 16 },
  menu: { backgroundColor: colors.bg, borderRadius: radius.lg, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md },
  menuText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  menuDivider: { height: 1, backgroundColor: colors.divider, marginHorizontal: 8 },

  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: colors.bg, maxHeight: "75%", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spacing.md },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginVertical: 6 },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: spacing.sm },
  pickerTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  pickerRow: { flexDirection: "row", alignItems: "center", padding: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickerIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  pickerName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  pickerSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
