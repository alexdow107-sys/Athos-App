import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";
import { hapticSelection } from "@/src/utils/haptics";

type FollowStatus = "accepted" | "pending";

export default function DiscoverScreen() {
  const router = useRouter();
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Local overrides after tapping Follow/Unfollow, keyed by user_id.
  const [followMap, setFollowMap] = useState<Record<string, FollowStatus | null>>({});

  const loadSuggestions = useCallback(async () => {
    try {
      const r = await api<{ users: any[] }>("/users/suggestions/list");
      setSuggestions(r.users);
      setFollowMap({});
    } catch {}
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const r = await api<{ users: any[] }>(`/users/search/q?q=${encodeURIComponent(query.trim())}`);
        setResults(r.users);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Effective follow status: local override wins, else what the server said.
  const statusFor = (u: any): FollowStatus | null => {
    if (u.user_id in followMap) return followMap[u.user_id];
    if (u.is_following) return "accepted";
    if (u.follow_pending) return "pending";
    return null;
  };

  const onToggleFollow = async (u: any) => {
    const current = statusFor(u);
    if (current) {
      setFollowMap((m) => ({ ...m, [u.user_id]: null }));
      try { await api(`/users/${u.user_id}/follow`, { method: "DELETE" }); }
      catch { setFollowMap((m) => ({ ...m, [u.user_id]: current })); }
    } else {
      hapticSelection();
      setFollowMap((m) => ({ ...m, [u.user_id]: "accepted" }));
      try {
        const r = await api<{ status: FollowStatus }>(`/users/${u.user_id}/follow`, { method: "POST" });
        setFollowMap((m) => ({ ...m, [u.user_id]: r.status || "accepted" }));
      } catch {
        setFollowMap((m) => ({ ...m, [u.user_id]: null }));
      }
    }
  };

  const list = query.trim() ? results : suggestions;
  const sectionLabel = query.trim() ? "Search results" : "Suggested for you";

  const renderUser = ({ item }: { item: any }) => {
    const status = statusFor(item);
    const isSelf = item.is_self || item.user_id === me?.user_id;
    return (
      <TouchableOpacity
        testID={`discover-user-${item.username}`}
        onPress={() => router.push(`/user/${item.username}`)}
        style={styles.userRow}
        activeOpacity={0.7}
      >
        <Avatar uri={item.profile_picture} name={item.display_name} size={48} />
        <View style={{ flex: 1, marginLeft: spacing.md, marginRight: spacing.sm }}>
          <Text style={styles.userName}>{item.display_name}</Text>
          <Text style={styles.userMeta}>@{item.username}{item.workouts_count ? ` · ${item.workouts_count} workouts` : ""}</Text>
          {item.bio ? <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text> : null}
        </View>
        {!isSelf && (status ? (
          <TouchableOpacity
            testID={`discover-following-${item.user_id}`}
            onPress={() => onToggleFollow(item)}
            style={styles.followingPill}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Ionicons name={status === "pending" ? "time-outline" : "checkmark"} size={13} color={colors.textSecondary} />
            <Text style={styles.followingPillText}>{status === "pending" ? "Requested" : "Following"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            testID={`discover-follow-${item.user_id}`}
            onPress={() => onToggleFollow(item)}
            style={styles.followPill}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Ionicons name="add" size={14} color={colors.textInverse} />
            <Text style={styles.followPillText}>Follow</Text>
          </TouchableOpacity>
        ))}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} testID="discover-screen" edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
      </View>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginLeft: 12 }} />
        <TextInput
          testID="discover-search-input"
          placeholder="Search athletes"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity testID="discover-search-clear" onPress={() => setQuery("")} style={{ paddingHorizontal: 12 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.section}>{sectionLabel}</Text>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={list}
          renderItem={renderUser}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={!query.trim() ? (
            <RefreshControl refreshing={refreshing} tintColor={colors.brand}
              onRefresh={() => { setRefreshing(true); loadSuggestions(); }} />
          ) : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>{query ? "No athletes found" : "No suggestions yet"}</Text>
              {!query && (
                <Text style={styles.emptySub}>New athletes will show up here as they join.</Text>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.lg },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 11, fontSize: 15, color: colors.text },
  section: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, marginHorizontal: spacing.md, textTransform: "uppercase" },
  userRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  userName: { fontWeight: "700", color: colors.text, fontSize: 15 },
  userMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  userBio: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  followPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full,
    backgroundColor: colors.brand,
  },
  followPillText: { color: colors.textInverse, fontWeight: "800", fontSize: 12 },
  followingPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: "transparent",
  },
  followingPillText: { color: colors.textSecondary, fontWeight: "700", fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32 },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: 8, fontWeight: "700" },
  emptySub: { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: "center" },
});
