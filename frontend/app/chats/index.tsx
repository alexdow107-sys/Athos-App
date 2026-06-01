import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { fmtRelative } from "@/src/utils/format";

export default function ChatsListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api<{ conversations: any[] }>("/conversations");
      setItems(r.conversations);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="chats-list-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 36 }} />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.conversation_id}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              testID={`chat-${c.conversation_id}`}
              style={styles.row}
              onPress={() => router.push(`/chats/${c.conversation_id}`)}
              activeOpacity={0.7}
            >
              <Avatar uri={c.other_user?.profile_picture} name={c.other_user?.display_name} size={48} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.name}>{c.other_user?.display_name || "User"}</Text>
                <Text style={styles.preview} numberOfLines={1}>{c.last_message || "Start a conversation"}</Text>
              </View>
              <Text style={styles.time}>{c.last_message_at ? fmtRelative(c.last_message_at) : ""}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySub}>Open a profile and tap Message to start chatting</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  name: { color: colors.text, fontWeight: "700", fontSize: 15 },
  preview: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  time: { color: colors.textMuted, fontSize: 11 },
  empty: { alignItems: "center", paddingTop: 64 },
  emptyText: { color: colors.text, fontWeight: "800", marginTop: 12 },
  emptySub: { color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: "center", paddingHorizontal: 32 },
});
