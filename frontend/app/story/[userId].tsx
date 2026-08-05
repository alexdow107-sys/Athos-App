import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator,
  Dimensions, Pressable, Platform, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Avatar } from "@/src/components/Avatar";
import { colors, spacing } from "@/src/theme";
import { fmtRelative } from "@/src/utils/format";

const { width: SW, height: SH } = Dimensions.get("window");
const STORY_MS = 5000;

export default function StoryViewer() {
  const { userId, name, pfp } = useLocalSearchParams<{ userId: string; name?: string; pfp?: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const owner = { display_name: name, profile_picture: pfp };

  const load = useCallback(async () => {
    try {
      const s = await api<{ stories: any[] }>(`/stories/user/${userId}`);
      setStories(s.stories || []);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { setLoading(true); setIdx(0); load(); }, [load]));

  // Auto-advance progress
  useEffect(() => {
    if (loading || stories.length === 0) return;
    setProgress(0);
    if (timer.current) clearInterval(timer.current);
    const step = 50;
    timer.current = setInterval(() => {
      setProgress((p) => {
        const next = p + step / STORY_MS;
        if (next >= 1) {
          advance();
          return 0;
        }
        return next;
      });
    }, step);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loading, stories.length]);

  const advance = () => {
    setIdx((i) => {
      if (i + 1 >= stories.length) {
        router.back();
        return i;
      }
      return i + 1;
    });
  };
  const back = () => setIdx((i) => Math.max(0, i - 1));

  const onDelete = () => {
    const s = stories[idx];
    if (!s) return;
    const doDelete = async () => {
      try {
        await api(`/stories/${s.story_id}`, { method: "DELETE" });
        const remaining = stories.filter((x) => x.story_id !== s.story_id);
        if (remaining.length === 0) { router.back(); return; }
        setStories(remaining);
        setIdx((i) => Math.min(i, remaining.length - 1));
      } catch (e: any) { Alert.alert("Failed", e?.message || ""); }
    };
    if (Platform.OS === "web") { if (window.confirm("Delete this story?")) doDelete(); return; }
    Alert.alert("Delete story?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator color="#fff" /></View>;
  }
  if (stories.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>No stories</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
      </View>
    );
  }

  const cur = stories[idx];
  const isSelf = me?.user_id === userId;

  return (
    <View style={styles.container} testID="story-viewer">
      <Image source={{ uri: cur.image }} style={styles.image} resizeMode="contain" />

      {/* Progress bars */}
      <View style={styles.progressRow}>
        {stories.map((_, i) => (
          <View key={i} style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${i < idx ? 100 : i === idx ? progress * 100 : 0}%` }]} />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Avatar uri={owner?.profile_picture} name={owner?.display_name} size={34} />
        <Text style={styles.name}>{isSelf ? "Your story" : owner?.display_name || "Story"}</Text>
        <Text style={styles.time}>{fmtRelative(cur.created_at)}</Text>
        <View style={{ flex: 1 }} />
        {isSelf && (
          <TouchableOpacity onPress={onDelete} style={{ padding: 6 }} testID="delete-story-btn">
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }} testID="close-story-btn">
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {cur.caption ? <Text style={styles.caption}>{cur.caption}</Text> : null}

      {/* Tap zones */}
      <Pressable style={styles.tapLeft} onPress={back} />
      <Pressable style={styles.tapRight} onPress={advance} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  image: { position: "absolute", width: SW, height: SH },
  progressRow: { position: "absolute", top: Platform.OS === "ios" ? 54 : 20, left: 8, right: 8, flexDirection: "row", gap: 4 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  progressFill: { height: 3, backgroundColor: "#fff" },
  header: { position: "absolute", top: Platform.OS === "ios" ? 66 : 32, left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: "#fff", fontWeight: "800", fontSize: 14 },
  time: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  caption: { position: "absolute", bottom: 80, left: 20, right: 20, color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  tapLeft: { position: "absolute", left: 0, top: 90, bottom: 0, width: SW * 0.33 },
  tapRight: { position: "absolute", right: 0, top: 90, bottom: 0, width: SW * 0.67 },
  empty: { color: "#fff", fontSize: 16 },
  closeBtn: { position: "absolute", top: 60, right: 20 },
});
