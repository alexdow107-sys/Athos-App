import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: any[] }>(`/conversations/${id}/messages`);
      setMessages(r.messages);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 5000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  const onSend = async () => {
    if (!text.trim() || sending) return;
    const body = text.trim();
    setText("");
    setSending(true);
    try {
      const r = await api<{ message: any }>(`/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: body }),
      });
      setMessages((prev) => [...prev, r.message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setText(body);
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="chat-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
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
                <View testID={`msg-${m.message_id}`} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {m.shared_workout_id ? (
                    <TouchableOpacity onPress={() => router.push(`/workout/${m.shared_workout_id}`)} testID="shared-workout">
                      <Text style={[styles.text, mine && styles.textMine, { fontStyle: "italic" }]}>📋 Shared a workout</Text>
                    </TouchableOpacity>
                  ) : m.shared_user_id ? (
                    <Text style={[styles.text, mine && styles.textMine, { fontStyle: "italic" }]}>👤 Shared a profile</Text>
                  ) : (
                    <Text style={[styles.text, mine && styles.textMine]}>{m.text}</Text>
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
          <TextInput
            testID="msg-input"
            placeholder="Message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            style={styles.input}
            multiline
          />
          <TouchableOpacity testID="msg-send-btn" onPress={onSend} disabled={!text.trim() || sending} style={styles.sendBtn}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, maxWidth: "80%", marginVertical: 3 },
  bubbleMine: { backgroundColor: colors.brand, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.bg2, alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  text: { color: colors.text, fontSize: 14 },
  textMine: { color: "#fff" },
  inputBar: { flexDirection: "row", padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, alignItems: "flex-end", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 64 },
  emptyText: { color: colors.textMuted, marginTop: 8 },
});
