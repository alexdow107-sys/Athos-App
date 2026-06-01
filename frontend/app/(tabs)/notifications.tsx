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

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ notifications: any[] }>("/notifications");
      setItems(r.notifications);
      await api("/notifications/read", { method: "POST" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const renderItem = ({ item }: { item: any }) => {
    const icon = ICONS[item.type] || { name: "notifications", color: colors.brand };
    const label = LABELS[item.type] || "Activity";
    return (
      <TouchableOpacity
        testID={`notif-${item.notification_id}`}
        activeOpacity={0.7}
        style={[styles.row, !item.read && styles.rowUnread]}
        onPress={() => {
          if (item.actor?.username && (item.type === "follow" || item.type === "follow_accepted")) {
            router.push(`/user/${item.actor.username}`);
          } else if (item.ref_id && (item.type === "like" || item.type === "comment" || item.type === "reply" || item.type === "save")) {
            // post_id => find workout from post
            (async () => {
              try {
                // We don't have a post detail endpoint, but we stored workout_id in posts
                // Just go to the actor's profile for MVP
                if (item.actor?.username) router.push(`/user/${item.actor.username}`);
              } catch {}
            })();
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

  return (
    <SafeAreaView style={styles.safe} testID="notifications-screen" edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(i) => i.notification_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.md },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowUnread: { backgroundColor: colors.brandLight + "40" },
  iconBadge: { position: "absolute", left: 48, top: 36, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  label: { color: colors.text, fontSize: 14 },
  bold: { fontWeight: "800" },
  time: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  requestActions: { flexDirection: "row", gap: 6 },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.md },
  miniAccept: { backgroundColor: colors.brand },
  miniDecline: { backgroundColor: colors.bg3 },
  miniBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 64 },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
});
