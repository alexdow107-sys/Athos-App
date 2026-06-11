import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";
import { Avatar } from "@/src/components/Avatar";

export default function BlockedScreen() {
  const router = useRouter();
  const [blocked, setBlocked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ blocked: any[] }>("/blocks");
      setBlocked(r.blocked || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const unblock = async (u: any) => {
    setBusy(u.user_id);
    setBlocked((prev) => prev.filter((b) => b.user_id !== u.user_id)); // optimistic
    try {
      await api(`/users/${u.user_id}/block`, { method: "DELETE" });
    } catch {
      load(); // revert from server on failure
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="blocked-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Accounts</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          {blocked.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="ban-outline" size={42} color={colors.textMuted} />
              <Text style={styles.emptyText}>{"You haven't blocked anyone"}</Text>
              <Text style={styles.emptySub}>{"Blocked accounts can't message you or see your posts."}</Text>
            </View>
          ) : (
            blocked.map((u) => (
              <View key={u.user_id} style={styles.row} testID={`blocked-${u.user_id}`}>
                <Avatar uri={u.profile_picture} name={u.display_name} size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{u.display_name}</Text>
                  <Text style={styles.handle}>@{u.username}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.unblockBtn, busy === u.user_id && { opacity: 0.5 }]}
                  onPress={() => unblock(u)}
                  disabled={busy === u.user_id}
                  activeOpacity={0.8}
                >
                  <Text style={styles.unblockText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { color: colors.text, fontWeight: "800", fontSize: 15, marginTop: 6 },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 32, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  name: { color: colors.text, fontWeight: "700", fontSize: 14 },
  handle: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  unblockBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg3 },
  unblockText: { color: colors.text, fontWeight: "800", fontSize: 13 },
});
