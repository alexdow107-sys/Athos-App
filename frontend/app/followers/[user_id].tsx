import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";

export default function FollowersScreen() {
  const { user_id, tab } = useLocalSearchParams<{ user_id: string; tab?: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"followers" | "following">((tab as any) || "followers");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ users: any[] }>(`/users/${user_id}/${activeTab}`);
      setItems(r.users);
    } finally { setLoading(false); }
  }, [user_id, activeTab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="followers-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{activeTab === "followers" ? "Followers" : "Following"}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity testID="tab-followers" onPress={() => setActiveTab("followers")} style={[styles.tabBtn, activeTab === "followers" && styles.tabActive]}>
          <Text style={[styles.tabText, activeTab === "followers" && styles.tabTextActive]}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-following" onPress={() => setActiveTab("following")} style={[styles.tabBtn, activeTab === "following" && styles.tabActive]}>
          <Text style={[styles.tabText, activeTab === "following" && styles.tabTextActive]}>Following</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.user_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`follower-${item.username}`}
              style={styles.row}
              onPress={() => router.push(`/user/${item.username}`)}
              activeOpacity={0.7}
            >
              <Avatar uri={item.profile_picture} name={item.display_name} size={44} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.name}>{item.display_name}</Text>
                <Text style={styles.meta}>@{item.username}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No {activeTab}</Text>
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
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.divider },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: colors.text, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  name: { color: colors.text, fontWeight: "700", fontSize: 14 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  emptyText: { color: colors.textMuted, padding: spacing.xl, textAlign: "center" },
});
