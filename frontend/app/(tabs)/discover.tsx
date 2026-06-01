import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";

export default function DiscoverScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ users: any[] }>("/users/suggestions/list");
        setSuggestions(r.users);
      } catch {}
    })();
  }, []);

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

  const list = query.trim() ? results : suggestions;
  const sectionLabel = query.trim() ? "Search results" : "Suggested for you";

  const renderUser = ({ item }: { item: any }) => (
    <TouchableOpacity
      testID={`discover-user-${item.username}`}
      onPress={() => router.push(`/user/${item.username}`)}
      style={styles.userRow}
      activeOpacity={0.7}
    >
      <Avatar uri={item.profile_picture} name={item.display_name} size={48} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={styles.userName}>{item.display_name}</Text>
        <Text style={styles.userMeta}>@{item.username}{item.workouts_count ? ` · ${item.workouts_count} workouts` : ""}</Text>
        {item.bio ? <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text> : null}
      </View>
      {item.is_premium ? <View style={styles.premiumBadge}><Text style={styles.premiumText}>PRO</Text></View> : null}
    </TouchableOpacity>
  );

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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>{query ? "No athletes found" : "No suggestions yet"}</Text>
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
  premiumBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.brandLight },
  premiumText: { color: colors.brand, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
});
