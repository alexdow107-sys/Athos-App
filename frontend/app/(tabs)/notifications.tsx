import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { fmtRelative } from "@/src/utils/format";

const ICONS: Record<string, any> = {
  follow: { name: "person-add", color: colors.brand },
  follow_request: { name: "person-add-outline", color: colors.brand },
  follow_accepted: { name: "checkmark-circle", color: colors.success },
  like: { name: "heart", color: colors.danger },
  comment: { name: "chatbubble", color: colors.brand },
  reply: { name: "chatbubble-ellipses", color: colors.brand },
  save: { name: "bookmark", color: colors.brand },
};

const LABELS: Record<string, string> = {
  follow: "started following you",
  follow_request: "requested to follow you",
  follow_accepted: "accepted your follow request",
  like: "liked your workout",
  comment: "commented on your workout",
  reply: "replied to your comment",
  save: "saved your workout",
};

type Tab = "activity" | "messages";

export default function NotificationsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("activity");
  const [items, setItems] = useState<any[]>([]);
  const [convos, setConvos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (tab === "activity") {
        const r = await api<{ notifications: any[] }>("/notifications");
        setItems(r.notifications);
        await api("/notifications/read", { method: "POST" });
      } else {
        const r = await api<{ conversations: any[] }>("/conversations");
        setConvos(r.conversations || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onAccept = async (follow_id: string) => {
    try {
      await api(`/users/follow-requests/${follow_id}/accept`, { method: "POST" });
      load();
    } catch {}
  };
  const onDecline = async (follow_id: string) => {
    try {
      await api(`/users/follow-requests/${follow_id}/decline`, { method: "POST" });
      load();
    } catch {}
  };

  const renderNotif = ({ item }: { item: any }) => {
    const icon = ICONS[item.type] || { name: "notifications", color: colors.brand };
    const label = LABELS[item.type] || "Activity";
    return (
      <TouchableOpacity
        testID={`notif-${item.notification_id}`}
        activeOpacity={0.7}
        style={[styles.row, !item.read && styles.rowUnread]}
        onPress={() => {
          if (item.actor?.username) {
            router.push(`/user/${item.actor.username}`);
          }
        }}
      >
        <Avatar uri={item.actor?.profile_picture} name={item.actor?.display_name} size={44} />
        <View style={[styles.iconBadge, { backgroundColor: colors.bg }]}>
          <Ionicons name={icon.name} size={14} color={icon.color} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.label}>
            <Text style={styles.bold}>{item.actor?.display_name || "Someone"}</Text> {label}
          </Text>
          <Text style={styles.time}>{fmtRelative(item.created_at)}</Text>
        </View>
        {item.type === "follow_request" && item.follow_id ? (
          <View style={styles.requestActions}>
            <TouchableOpacity testID={`accept-${item.follow_id}`} onPress={() => onAccept(item.follow_id)} style={[styles.miniBtn, styles.miniAccept]}>
              <Text style={styles.miniBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity testID={`decline-${item.follow_id}`} onPress={() => onDecline(item.follow_id)} style={[styles.miniBtn, styles.miniDecline]}>
              <Text style={[styles.miniBtnText, { color: colors.text }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderConvo = ({ item }: { item: any }) => {
    const u = item.other_user;
    const unread = item.unread_count || 0;
    return (
      <TouchableOpacity
        testID={`convo-${item.conversation_id}`}
        activeOpacity={0.7}
        style={styles.row}
        onPress={() => router.push(`/chats/${item.conversation_id}`)}
      >
        <Avatar uri={u?.profile_picture} name={u?.display_name} size={44} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.bold}>{u?.display_name || "User"}</Text>
            {item.last_message_at ? (
              <Text style={styles.time}>{fmtRelative(item.last_message_at)}</Text>
            ) : null}
          </View>
          <Text style={[styles.label, unread > 0 && { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
            {item.last_message || "Tap to send a message"}
          </Text>
        </View>
        {unread > 0 ? (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} testID="notifications-screen" edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>
      <View style={styles.tabs}>
        <TouchableOpacity
          testID="activity-tab-notifs"
          onPress={() => { setTab("activity"); setLoading(true); }}
          style={[styles.tabBtn, tab === "activity" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "activity" && styles.tabTextActive]}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="activity-tab-messages"
          onPress={() => { setTab("messages"); setLoading(true); }}
          style={[styles.tabBtn, tab === "messages" && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === "messages" && styles.tabTextActive]}>Messages</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : tab === "activity" ? (
        <FlatList
          data={items}
          renderItem={renderNotif}
          keyExtractor={(i) => i.notification_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={convos}
          renderItem={renderConvo}
          keyExtractor={(c) => c.conversation_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySub}>Open a user&apos;s profile and tap Message to start one.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.md, paddingBottom: 0 },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, marginTop: spacing.sm },
  tabBtn: { paddingVertical: 10, marginRight: spacing.lg },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  tabText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.text, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowUnread: { backgroundColor: colors.brandLight + "40" },
  iconBadge: { position: "absolute", left: 48, top: 36, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  label: { color: colors.textSecondary, fontSize: 14 },
  bold: { fontWeight: "800", color: colors.text, fontSize: 14 },
  time: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  requestActions: { flexDirection: "row", gap: 6 },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.md },
  miniAccept: { backgroundColor: colors.brand },
  miniDecline: { backgroundColor: colors.bg3 },
  miniBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  unreadDot: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },
  unreadDotText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  empty: { alignItems: "center", paddingVertical: 64, paddingHorizontal: 32 },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: 8, fontWeight: "700" },
  emptySub: { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: "center" },
});
