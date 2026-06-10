import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
  Modal, Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { fmtDuration, fmtDistance, fmtPace } from "@/src/utils/format";

type Visibility = "public" | "private";

function zeroPad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export default function SaveCardioScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { user } = useAuth();
  const distUnit = (user?.distance_unit as "km" | "mi") || "km";
  const [cardio, setCardio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [visSheetOpen, setVisSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<{ cardio: any }>(`/cardio/${id}`)
      .then(r => setCardio(r.cardio))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const onPickPhoto = async () => {
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "We need photo access to add images.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.6,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const dataUri = asset.base64
        ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
        : asset.uri;
      setPhotos(prev => prev.length >= 6 ? prev : [...prev, dataUri]);
    } catch (e: any) {
      Alert.alert("Could not pick image", e?.message || "Try again");
    }
  };

  const onPost = async () => {
    setSaving(true);
    try {
      await api(`/cardio/${id}/post`, {
        method: "POST",
        body: JSON.stringify({ caption, photos, visibility }),
      });
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Could not post");
    } finally {
      setSaving(false);
    }
  };

  const onSkip = () => router.replace("/(tabs)" as any);

  if (loading || !cardio) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const pace = cardio.distance_km && cardio.duration_seconds
    ? fmtPace(cardio.duration_seconds, cardio.distance_km, distUnit)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onSkip} style={styles.iconBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Activity</Text>
          <TouchableOpacity
            onPress={onPost}
            disabled={saving}
            style={[styles.postBtn, saving && { opacity: 0.5 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.postBtnText}>Post</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Activity summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.typeIcon}>
                <Ionicons name="fitness-outline" size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryType}>{cardio.type}</Text>
                <Text style={styles.summaryDate}>
                  {new Date(cardio.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatCell label="Duration" value={fmtDuration(cardio.duration_seconds)} />
              {cardio.distance_km != null && (
                <>
                  <View style={styles.statLine} />
                  <StatCell label="Distance" value={fmtDistance(cardio.distance_km, distUnit)} />
                </>
              )}
              {pace && (
                <>
                  <View style={styles.statLine} />
                  <StatCell label="Avg Pace" value={pace} />
                </>
              )}
            </View>

            {cardio.notes ? (
              <Text style={styles.notesText}>{cardio.notes}</Text>
            ) : null}
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri: p }} style={styles.photo} />
                  <TouchableOpacity onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} style={styles.photoRemove}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 6 && (
                <TouchableOpacity onPress={onPickPhoto} style={styles.addPhoto} activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={26} color={colors.brand} />
                  <Text style={styles.addPhotoText}>Add photo</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Caption */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="How did it go? Share the details…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              style={styles.captionInput}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{caption.length}/500</Text>
          </View>

          {/* Visibility */}
          <TouchableOpacity onPress={() => setVisSheetOpen(true)} style={styles.rowItem} activeOpacity={0.7}>
            <Ionicons name={visibility === "public" ? "earth" : "lock-closed"} size={20} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Visibility</Text>
              <Text style={styles.rowSub}>
                {visibility === "public" ? "Everyone can see this activity" : "Only you can see this activity"}
              </Text>
            </View>
            <Text style={styles.rowValue}>{visibility === "public" ? "Everyone" : "Private"}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Skip to just save without posting */}
          <TouchableOpacity onPress={onSkip} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipBtnText}>Save without posting</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Visibility sheet */}
      <Modal visible={visSheetOpen} transparent animationType="slide" onRequestClose={() => setVisSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setVisSheetOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Activity visibility</Text>
            {([
              { v: "public" as Visibility, icon: "earth" as const, title: "Everyone", desc: "This activity will appear on your profile and the feed." },
              { v: "private" as Visibility, icon: "lock-closed" as const, title: "Private", desc: "Only you can see this activity." },
            ]).map(opt => (
              <TouchableOpacity
                key={opt.v}
                onPress={() => { setVisibility(opt.v); setVisSheetOpen(false); }}
                style={[styles.sheetRow, visibility === opt.v && { borderColor: colors.brand }]}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIcon, visibility === opt.v && { backgroundColor: colors.brand }]}>
                  <Ionicons name={opt.icon} size={18} color={visibility === opt.v ? "#fff" : colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetRowTitle}>{opt.title}</Text>
                  <Text style={styles.sheetRowDesc}>{opt.desc}</Text>
                </View>
                {visibility === opt.v && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.bg2, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  iconBtn: { padding: 6, width: 56 },
  skipText: { color: colors.textMuted, fontWeight: "600", fontSize: 14 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: colors.text },
  postBtn: { backgroundColor: colors.brand, paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.full },
  postBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  scroll: { padding: spacing.lg, paddingBottom: 60 },

  summaryCard: {
    backgroundColor: colors.bg2, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    marginBottom: spacing.xl,
  },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  typeIcon: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center",
  },
  summaryType: { fontSize: 17, fontWeight: "900", color: colors.text },
  summaryDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statsRow: {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, borderTopColor: colors.divider,
    paddingVertical: spacing.md,
  },
  statCell: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  statLine: { width: 1, height: 30, backgroundColor: colors.divider },
  notesText: {
    color: colors.textSecondary, fontSize: 13, lineHeight: 18,
    borderTopWidth: 1, borderTopColor: colors.divider,
    padding: spacing.md,
  },

  section: { marginBottom: spacing.lg },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm },

  addPhoto: {
    width: 100, height: 100, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", backgroundColor: colors.bg,
  },
  addPhotoText: { color: colors.brand, fontSize: 11, fontWeight: "700", marginTop: 6, textAlign: "center" },
  photoWrap: { position: "relative" },
  photo: { width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.bg2 },
  photoRemove: {
    position: "absolute", top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center",
  },

  captionInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 90,
    backgroundColor: colors.bg2,
  },
  charCount: { color: colors.textMuted, fontSize: 11, alignSelf: "flex-end", marginTop: 4 },

  rowItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginBottom: spacing.lg,
    backgroundColor: colors.bg2,
  },
  rowTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  rowSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  rowValue: { color: colors.brand, fontWeight: "800", fontSize: 13 },

  skipBtn: { alignItems: "center", paddingVertical: spacing.md },
  skipBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg, padding: spacing.lg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 14 },
  sheetRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: 8,
  },
  sheetIcon: {
    width: 36, height: 36, borderRadius: 9, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  sheetRowTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  sheetRowDesc: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
});
