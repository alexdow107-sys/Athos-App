import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Avatar } from "@/src/components/Avatar";
import { colors, radius, spacing } from "@/src/theme";

export type SharePayload =
  | { kind: "workout"; workout_id: string; preview?: string }
  | { kind: "profile"; user_id: string; preview?: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  payload: SharePayload | null;
  onSent?: () => void;
}

/**
 * Bottom-sheet style picker that lets the user send a workout or profile
 * card to any of their existing conversations, OR search for a user to
 * start a new conversation with.
 */
export const ShareToChatSheet: React.FC<Props> = ({ visible, onClose, payload, onSent }) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    (async () => {
      try {
        const r = await api<{ conversations: any[] }>("/conversations");
        setConversations(r.conversations || []);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (!query.trim()) { setUsers([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api<{ users: any[] }>(`/users/search/q?q=${encodeURIComponent(query.trim())}`);
        setUsers(r.users || []);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [query, visible]);

  const sendToConversation = async (conversation_id: string, key: string) => {
    if (!payload) return;
    setSending(key);
    try {
      const body: any = { text: payload.preview || "" };
      if (payload.kind === "workout") body.shared_workout_id = payload.workout_id;
      if (payload.kind === "profile") body.shared_user_id = payload.user_id;
      await api(`/conversations/${conversation_id}/messages`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onSent?.();
      onClose();
    } catch {} finally {
      setSending(null);
    }
  };

  const sendToUser = async (user_id: string) => {
    setSending(`u_${user_id}`);
    try {
      const c = await api<{ conversation_id: string }>("/conversations/start", {
        method: "POST",
        body: JSON.stringify({ user_id }),
      });
      await sendToConversation(c.conversation_id, `u_${user_id}`);
    } finally {
      setSending(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={["bottom"]} testID="share-sheet">
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Send to</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="share-sheet-close">
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {payload ? (
            <View style={styles.preview}>
              <Ionicons
                name={payload.kind === "workout" ? "barbell" : "person-circle"}
                size={20}
                color={colors.brand}
              />
              <Text style={styles.previewText}>
                {payload.kind === "workout" ? "Sharing a workout" : "Sharing a profile"}
              </Text>
            </View>
          ) : null}

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a user..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={styles.searchInput}
              testID="share-sheet-search"
            />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={query.trim() ? users : conversations}
              keyExtractor={(it: any) => it.conversation_id || it.user_id}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.emptyText}>
                    {query.trim() ? "No users found" : "No conversations yet. Search a user to start."}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                if (query.trim()) {
                  const u = item;
                  const key = `u_${u.user_id}`;
                  return (
                    <TouchableOpacity
                      testID={`share-user-${u.username}`}
                      onPress={() => sendToUser(u.user_id)}
                      disabled={!!sending}
                      style={styles.row}
                    >
                      <Avatar uri={u.profile_picture} name={u.display_name} size={42} />
                      <View style={{ flex: 1, marginLeft: spacing.md }}>
                        <Text style={styles.name}>{u.display_name}</Text>
                        <Text style={styles.sub}>@{u.username}</Text>
                      </View>
                      {sending === key ? (
                        <ActivityIndicator color={colors.brand} />
                      ) : (
                        <Ionicons name="paper-plane" size={18} color={colors.brand} />
                      )}
                    </TouchableOpacity>
                  );
                }
                const c = item;
                const key = c.conversation_id;
                return (
                  <TouchableOpacity
                    testID={`share-conv-${key}`}
                    onPress={() => sendToConversation(key, key)}
                    disabled={!!sending}
                    style={styles.row}
                  >
                    <Avatar uri={c.other_user?.profile_picture} name={c.other_user?.display_name} size={42} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={styles.name}>{c.other_user?.display_name || "User"}</Text>
                      <Text style={styles.sub} numberOfLines={1}>{c.last_message || "Tap to send"}</Text>
                    </View>
                    {sending === key ? (
                      <ActivityIndicator color={colors.brand} />
                    ) : (
                      <Ionicons name="paper-plane" size={18} color={colors.brand} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "80%", paddingHorizontal: spacing.md, paddingTop: 6,
    ...(Platform.OS === "web" ? { boxShadow: "0 -4px 20px rgba(0,0,0,0.15)" } as any : {}),
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginVertical: 6 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm },
  title: { color: colors.text, fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  closeBtn: { padding: 6 },
  preview: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.brandLight, borderRadius: radius.md, marginBottom: spacing.sm,
  },
  previewText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 10 : 6, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.divider },
  name: { color: colors.text, fontWeight: "700", fontSize: 14 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 32, paddingHorizontal: 24 },
  emptyText: { color: colors.textMuted, marginTop: 8, textAlign: "center", fontSize: 13 },
});
