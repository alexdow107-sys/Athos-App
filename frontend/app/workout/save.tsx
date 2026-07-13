import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator, Modal, Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { api } from "@/src/api/client";
import { useWorkout } from "@/src/context/WorkoutContext";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";
import { fmtDuration, fmtVolume } from "@/src/utils/format";
import { hapticSuccess } from "@/src/utils/haptics";
import { PRCelebration } from "@/src/components/PRCelebration";

type Visibility = "public" | "private";

export default function SaveWorkoutScreen() {
  const router = useRouter();
  const { active, elapsed, finishWorkout, cancelWorkout } = useWorkout();
  const { user } = useAuth();

  const [name, setName] = useState(active?.name || "Workout");
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [visSheetOpen, setVisSheetOpen] = useState(false);
  const [saveAsRoutine, setSaveAsRoutine] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [prs, setPrs] = useState<any[] | null>(null);

  // A PR was hit — show the celebration (it navigates home on close).
  if (prs) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <PRCelebration
          visible
          prs={prs}
          weightUnit={user?.weight_unit || "kg"}
          onClose={() => router.replace("/(tabs)" as any)}
        />
      </SafeAreaView>
    );
  }

  // Saved successfully (or mid-save after finishWorkout cleared the active
  // workout) — show a quick confirmation instead of flashing the empty state.
  if (justSaved || (!active && saving)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.savedWrap} testID="workout-saved-overlay">
          <View style={styles.savedCircle}><Ionicons name="checkmark" size={44} color="#fff" /></View>
          <Text style={styles.savedText}>Workout saved</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!active) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No workout to save</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.linkBtn}>
            <Text style={styles.linkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const completedSets = active.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0,
  );
  const totalVolume = active.exercises.reduce((acc, ex) => {
    return acc + ex.sets.reduce((sum, s) => {
      if (!s.completed) return sum;
      if (ex.is_unilateral) {
        return sum + (s.left_weight || 0) * (s.left_reps || 0) + (s.right_weight || 0) * (s.right_reps || 0);
      }
      return sum + (s.weight || 0) * (s.reps || 0);
    }, 0);
  }, 0);

  const onPickPhoto = async () => {
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "We need photo access to add images to your workout.");
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
      setPhotos((prev) => (prev.length >= 6 ? prev : [...prev, dataUri]));
    } catch (e: any) {
      Alert.alert("Could not pick image", e?.message || "Try again");
    }
  };

  const removePhoto = (i: number) =>
    setPhotos((p) => p.filter((_, idx) => idx !== i));

  const onSave = async () => {
    setSaving(true);
    try {
      // Optionally save this workout's exercises as a reusable routine (before
      // finishWorkout clears the active workout).
      if (saveAsRoutine && active) {
        const routineExercises = active.exercises.map((ex) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          is_unilateral: ex.is_unilateral,
          machine: ex.machine || null,
          target_sets: Math.max(1, ex.sets.length),
        }));
        if (routineExercises.length > 0) {
          await api("/routines", {
            method: "POST",
            body: JSON.stringify({ name, exercises: routineExercises }),
          }).catch(() => {});
        }
      }
      const r = await finishWorkout({
        name,
        caption,
        photos,
        visibility,
      });
      if (r?.prs?.length) {
        // Celebrate the PR (any visibility — it's the user's own achievement).
        // The overlay handles navigation when dismissed, so keep `saving` true.
        hapticSuccess();
        setPrs(r.prs);
        return;
      }
      // Show a brief "Workout saved" confirmation, then head to the home screen.
      hapticSuccess();
      setJustSaved(true);
      setTimeout(() => router.replace("/(tabs)" as any), 750);
    } catch (e: any) {
      const msg = e?.message || "Could not save workout";
      if (Platform.OS === "web") window.alert("Failed: " + msg);
      else Alert.alert("Failed", msg);
      setSaving(false);
    }
  };

  const onDiscard = () => {
    const doDiscard = async () => {
      await cancelWorkout();
      router.replace("/(tabs)" as any);
    };
    if (Platform.OS === "web") {
      if (window.confirm("Discard workout? All progress will be lost.")) doDiscard();
      return;
    }
    Alert.alert("Discard workout?", "All progress will be lost", [
      { text: "Cancel", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: doDiscard },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="save-workout-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="save-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Save Workout</Text>
          <TouchableOpacity
            testID="save-workout-btn"
            onPress={onSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <TextInput
            testID="save-name-input"
            value={name}
            onChangeText={setName}
            style={styles.titleInput}
            placeholder="Workout name"
            placeholderTextColor={colors.textMuted}
          />

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{fmtDuration(elapsed)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Volume</Text>
              <Text style={styles.statValue}>{fmtVolume(totalVolume, user?.weight_unit || "kg")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Sets</Text>
              <Text style={styles.statValue}>{completedSets}</Text>
            </View>
          </View>

          <Text style={styles.when}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />{"  "}
            When: {new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </Text>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photos & video</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri: p }} style={styles.photo} />
                  <TouchableOpacity onPress={() => removePhoto(i)} style={styles.photoRemove} testID={`remove-photo-${i}`}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 6 && (
                <TouchableOpacity onPress={onPickPhoto} style={styles.addPhoto} testID="add-photo-btn" activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={26} color={colors.brand} />
                  <Text style={styles.addPhotoText}>Add photo/video</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Caption */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              testID="save-caption-input"
              value={caption}
              onChangeText={setCaption}
              placeholder="How did your workout go?"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              style={styles.captionInput}
            />
            <Text style={styles.charCount}>{caption.length}/500</Text>
          </View>

          {/* Visibility */}
          <TouchableOpacity
            testID="save-visibility-btn"
            onPress={() => setVisSheetOpen(true)}
            style={styles.rowItem}
            activeOpacity={0.7}
          >
            <Ionicons
              name={visibility === "public" ? "earth" : "lock-closed"}
              size={20}
              color={colors.text}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Visibility</Text>
              <Text style={styles.rowSub}>
                {visibility === "public" ? "Everyone can see your workout" : "Only your username & workout name visible"}
              </Text>
            </View>
            <Text style={styles.rowValue}>{visibility === "public" ? "Everyone" : "Private"}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Save as routine */}
          <TouchableOpacity
            testID="save-as-routine-toggle"
            onPress={() => setSaveAsRoutine((v) => !v)}
            style={styles.rowItem}
            activeOpacity={0.7}
          >
            <Ionicons name="repeat" size={20} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Save as routine</Text>
              <Text style={styles.rowSub}>Reuse these exercises next time — just log weight & reps</Text>
            </View>
            <View style={[styles.checkbox, saveAsRoutine && styles.checkboxOn]}>
              {saveAsRoutine && <Ionicons name="checkmark" size={15} color={colors.textInverse} />}
            </View>
          </TouchableOpacity>

          {/* Discard */}
          <TouchableOpacity
            testID="save-discard-btn"
            onPress={onDiscard}
            style={styles.discardBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={18} color={colors.danger} />
            <Text style={styles.discardText}>Discard Workout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Visibility sheet */}
      <Modal visible={visSheetOpen} transparent animationType="slide" onRequestClose={() => setVisSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setVisSheetOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Workout visibility</Text>
            {[
              { v: "public" as Visibility, icon: "earth" as const, title: "Everyone", desc: "Full workout (sets, reps, volume, PRs) is visible on the feed." },
              { v: "private" as Visibility, icon: "lock-closed" as const, title: "Private", desc: "Only your username and workout name will be shared. No exercises or stats." },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.v}
                testID={`vis-${opt.v}`}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { color: colors.textMuted },
  savedWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  savedCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  savedText: { color: colors.text, fontSize: 18, fontWeight: "800" },
  linkBtn: { marginTop: 12, padding: 10 },
  linkText: { color: colors.brand, fontWeight: "700" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  iconBtn: { padding: 6, width: 40 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: colors.text },
  saveBtn: { backgroundColor: colors.brand, paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.full },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  titleInput: { fontSize: 24, fontWeight: "900", color: colors.text, paddingVertical: 8, letterSpacing: -0.5 },

  statsRow: {
    flexDirection: "row", backgroundColor: colors.bg2, borderRadius: radius.lg,
    padding: spacing.md, alignItems: "center", marginTop: spacing.md,
  },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 4 },
  when: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, fontWeight: "600" },

  section: { marginTop: spacing.xl },
  sectionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "800", letterSpacing: 0.5, marginBottom: spacing.sm, textTransform: "uppercase" },
  addPhoto: {
    width: 100, height: 100, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: colors.bg,
  },
  addPhotoText: { color: colors.brand, fontSize: 11, fontWeight: "700", marginTop: 6, textAlign: "center" },
  photoWrap: { position: "relative" },
  photo: { width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.bg2 },
  photoRemove: {
    position: "absolute", top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  captionInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 80,
    textAlignVertical: "top", backgroundColor: colors.bg,
  },
  charCount: { color: colors.textMuted, fontSize: 11, alignSelf: "flex-end", marginTop: 4 },

  rowItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  rowTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  rowSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  rowValue: { color: colors.brand, fontWeight: "800", fontSize: 13 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },

  discardBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(192,64,64,0.40)", backgroundColor: "rgba(192,64,64,0.10)",
  },
  discardText: { color: colors.danger, fontWeight: "800", fontSize: 14 },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.bg, padding: spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === "ios" ? 32 : 20 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 14 },
  sheetRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: 8,
  },
  sheetIcon: {
    width: 36, height: 36, borderRadius: 9, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  sheetRowTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  sheetRowDesc: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
});
