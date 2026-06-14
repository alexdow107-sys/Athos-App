import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Switch, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Linking } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Avatar } from "@/src/components/Avatar";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";

// TODO: replace with your real support inbox before launch
const SUPPORT_EMAIL = "support@athos.app";

function SettingRow({ icon, label, onPress, value, danger, first, testID }: {
  icon: any; label: string; onPress?: () => void; value?: string; danger?: boolean; first?: boolean; testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.cardRow, !first && styles.cardRowBorder]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.brand} />
      <Text style={[styles.cardRowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {value != null
        ? <Text style={styles.cardRowValue}>{value}</Text>
        : onPress ? <Ionicons name="chevron-forward" size={17} color={colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, refresh, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [profilePicture, setProfilePicture] = useState<string | null>(user?.profile_picture || null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft_in">((user?.height_unit as any) || "cm");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">((user?.weight_unit as any) || "kg");
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">((user?.distance_unit as any) || "km");
  const [height, setHeight] = useState(String(user?.height || ""));
  const [weight, setWeight] = useState(String(user?.weight || ""));
  const [isPrivate, setIsPrivate] = useState(!!user?.is_private);
  const [hideFollowers, setHideFollowers] = useState(!!user?.hide_followers);
  const [showStatus, setShowStatus] = useState(user?.show_workout_status !== false);
  const [saving, setSaving] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const appVersion = Constants.expoConfig?.version || "1.0.0";

  const openSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Athos Support")}`).catch(() => {});
  };
  const openNotifSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const showToast = () => {
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const onPickAvatar = async () => {
    setPickingPhoto(true);
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "We need photo access to set your profile picture.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const dataUri = asset.base64
        ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
        : asset.uri;
      setProfilePicture(dataUri);
      // Save immediately so it's reflected everywhere
      try {
        await api("/users/me", { method: "PATCH", body: JSON.stringify({ profile_picture: dataUri }) });
        await refresh();
      } catch (e: any) {
        Alert.alert("Upload failed", e?.message || "Try again");
      }
    } catch (e: any) {
      Alert.alert("Could not pick image", e?.message || "Try again");
    } finally {
      setPickingPhoto(false);
    }
  };

  const onRemoveAvatar = () => {
    Alert.alert("Remove profile picture?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setProfilePicture(null);
          try {
            await api("/users/me", { method: "PATCH", body: JSON.stringify({ profile_picture: null }) });
            await refresh();
          } catch {}
        },
      },
    ]);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await api("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName,
          username,
          bio,
          height_unit: heightUnit,
          weight_unit: weightUnit,
          height: height ? parseFloat(height) : null,
          weight: weight ? parseFloat(weight) : null,
          distance_unit: distanceUnit,
          is_private: isPrivate,
          hide_followers: hideFollowers,
          show_workout_status: showStatus,
        }),
      });
      await refresh();
      showToast();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally { setSaving(false); }
  };

  const onLogout = () => {
    if (Platform.OS === "web") {
      if (!window.confirm("Sign out of Athos?")) return;
      logout().then(() => router.replace("/auth/login"));
      return;
    }
    Alert.alert("Sign out?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => {
        await logout();
        router.replace("/auth/login");
      }},
    ]);
  };

  const onDeleteAccount = () => {
    if (Platform.OS === "web") {
      if (!window.confirm("Delete account? This permanently removes your account, workouts, posts, and messages.")) return;
      if (!window.confirm("Are you absolutely sure? This cannot be undone.")) return;
      api("/users/me", { method: "DELETE" })
        .then(() => logout())
        .then(() => router.replace("/auth/login"))
        .catch((e: any) => window.alert(e.message || "Could not delete account."));
      return;
    }
    Alert.alert(
      "Delete account?",
      "This permanently removes your account, workouts, posts, follows, and messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "All your data will be gone for good.",
              [
                { text: "Keep my account", style: "cancel" },
                {
                  text: "Yes, delete everything",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await api("/users/me", { method: "DELETE" });
                      await logout();
                      router.replace("/auth/login");
                    } catch (e: any) {
                      Alert.alert("Failed", e.message || "Could not delete account.");
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="settings-screen">
      <Animated.View style={[styles.toast, {
        opacity: toastAnim,
        transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }]} pointerEvents="none">
        <Ionicons name="checkmark-circle" size={16} color={colors.brand} />
        <Text style={styles.toastText}>Changes saved</Text>
      </Animated.View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Profile</Text>

          <View style={styles.avatarBlock}>
            <TouchableOpacity onPress={onPickAvatar} disabled={pickingPhoto} activeOpacity={0.7} testID="settings-avatar-btn">
              <View>
                <Avatar uri={profilePicture} name={displayName || user?.display_name} size={92} />
                <View style={styles.avatarBadge}>
                  {pickingPhoto ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#fff" />
                  )}
                </View>
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.avatarTitle}>Profile picture</Text>
              <Text style={styles.avatarDesc}>
                Tap your photo to choose a new one from your library.
              </Text>
              {profilePicture ? (
                <TouchableOpacity onPress={onRemoveAvatar} style={styles.avatarRemove} testID="settings-avatar-remove">
                  <Text style={styles.avatarRemoveText}>Remove photo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <Text style={styles.label}>Display name</Text>
          <TextInput testID="settings-displayname" value={displayName} onChangeText={setDisplayName} style={styles.input} placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Username</Text>
          <TextInput testID="settings-username" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} autoCapitalize="none" style={styles.input} placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Bio</Text>
          <TextInput testID="settings-bio" value={bio} onChangeText={setBio} multiline style={[styles.input, { minHeight: 60 }]} placeholder="Tell people about your training" placeholderTextColor={colors.textMuted} />

          <Text style={styles.section}>Body</Text>
          <Text style={styles.label}>Height ({heightUnit === "cm" ? "cm" : "in"})</Text>
          <TextInput testID="settings-height" value={height} onChangeText={setHeight} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Weight ({weightUnit})</Text>
          <TextInput testID="settings-weight" value={weight} onChangeText={setWeight} keyboardType="numeric" style={styles.input} placeholderTextColor={colors.textMuted} />

          <Text style={styles.section}>Units</Text>
          <View style={styles.row}>
            <TouchableOpacity testID="unit-kg" onPress={() => setWeightUnit("kg")} style={[styles.choice, weightUnit === "kg" && styles.choiceActive]}>
              <Text style={[styles.choiceText, weightUnit === "kg" && styles.choiceTextActive]}>Kilograms</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="unit-lb" onPress={() => setWeightUnit("lb")} style={[styles.choice, weightUnit === "lb" && styles.choiceActive]}>
              <Text style={[styles.choiceText, weightUnit === "lb" && styles.choiceTextActive]}>Pounds</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <TouchableOpacity testID="unit-cm" onPress={() => setHeightUnit("cm")} style={[styles.choice, heightUnit === "cm" && styles.choiceActive]}>
              <Text style={[styles.choiceText, heightUnit === "cm" && styles.choiceTextActive]}>Centimeters</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="unit-ft" onPress={() => setHeightUnit("ft_in")} style={[styles.choice, heightUnit === "ft_in" && styles.choiceActive]}>
              <Text style={[styles.choiceText, heightUnit === "ft_in" && styles.choiceTextActive]}>Feet & Inches</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Distance</Text>
          <View style={styles.row}>
            <TouchableOpacity testID="unit-km" onPress={() => setDistanceUnit("km")} style={[styles.choice, distanceUnit === "km" && styles.choiceActive]}>
              <Text style={[styles.choiceText, distanceUnit === "km" && styles.choiceTextActive]}>Kilometers (km)</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="unit-mi" onPress={() => setDistanceUnit("mi")} style={[styles.choice, distanceUnit === "mi" && styles.choiceActive]}>
              <Text style={[styles.choiceText, distanceUnit === "mi" && styles.choiceTextActive]}>Miles (mi)</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.section}>Privacy</Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Private account</Text>
              <Text style={styles.toggleDesc}>Approve followers manually</Text>
            </View>
            <Switch testID="toggle-private" value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: colors.brand, false: colors.border }} />
          </View>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Hide followers list</Text>
              <Text style={styles.toggleDesc}>Others can&apos;t see who follows you</Text>
            </View>
            <Switch testID="toggle-hide-followers" value={hideFollowers} onValueChange={setHideFollowers} trackColor={{ true: colors.brand, false: colors.border }} />
          </View>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Show &quot;Currently Working Out&quot;</Text>
              <Text style={styles.toggleDesc}>Display live status on your profile</Text>
            </View>
            <Switch testID="toggle-show-status" value={showStatus} onValueChange={setShowStatus} trackColor={{ true: colors.brand, false: colors.border }} />
          </View>

          <Text style={styles.section}>Safety</Text>
          <View style={styles.card}>
            <SettingRow first testID="blocked-accounts-link" icon="ban-outline" label="Blocked accounts" onPress={() => router.push("/blocked")} />
          </View>

          <View style={{ marginTop: spacing.xl }}>
            <Button testID="save-settings-btn" title="Save changes" onPress={onSave} loading={saving} />
          </View>

          {Platform.OS !== "web" && (
            <>
              <Text style={styles.section}>Notifications</Text>
              <View style={styles.card}>
                <SettingRow first icon="notifications-outline" label="Notification settings" onPress={openNotifSettings} />
              </View>
            </>
          )}

          <Text style={styles.section}>Support & About</Text>
          <View style={styles.card}>
            <SettingRow first testID="help-support-row" icon="help-buoy-outline" label="Help & Support" onPress={openSupport} />
            <SettingRow testID="terms-row" icon="document-text-outline" label="Terms of Service" onPress={() => router.push("/legal/terms" as any)} />
            <SettingRow testID="privacy-row" icon="lock-closed-outline" label="Privacy Policy" onPress={() => router.push("/legal/privacy" as any)} />
            <SettingRow icon="information-circle-outline" label="Version" value={appVersion} />
          </View>

          <View style={{ marginTop: spacing.xl }}>
            <Button testID="logout-btn" title="Sign out" variant="ghost" onPress={onLogout} />
          </View>

          <Text style={styles.section}>Danger zone</Text>
          <TouchableOpacity
            testID="delete-account-btn"
            onPress={onDeleteAccount}
            style={styles.dangerBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={18} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerTitle}>Delete account</Text>
              <Text style={styles.dangerDesc}>
                Permanently delete your account and all data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.danger} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  section: { fontSize: 11, fontWeight: "900", color: colors.textMuted, letterSpacing: 1.2, marginTop: spacing.xl, marginBottom: spacing.sm, textTransform: "uppercase" },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.bg },
  row: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 11, alignItems: "center" },
  choiceActive: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  choiceText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  choiceTextActive: { color: colors.brand, fontWeight: "800" },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  toggleTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  toggleDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  linkRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.lg, gap: 10 },
  linkText: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 14 },
  card: { backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginTop: spacing.sm },
  cardRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 14, gap: 12 },
  cardRowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  cardRowLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  cardRowValue: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  dangerBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: "rgba(192,64,64,0.40)", backgroundColor: "rgba(192,64,64,0.10)",
  },
  dangerTitle: { color: colors.danger, fontWeight: "800", fontSize: 14 },
  dangerDesc: { color: colors.danger, fontSize: 12, marginTop: 2, opacity: 0.85 },

  avatarBlock: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, marginTop: spacing.sm },
  avatarBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.bg,
  },
  avatarTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  avatarDesc: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  avatarRemove: { marginTop: 8, alignSelf: "flex-start" },
  avatarRemoveText: { color: colors.danger, fontSize: 12, fontWeight: "700" },

  toast: {
    position: "absolute", top: 56, alignSelf: "center", zIndex: 100,
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.brand,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  toastText: { color: colors.text, fontSize: 13, fontWeight: "700" },
});
