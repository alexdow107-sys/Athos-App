import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/src/theme";

// Plain-language starter copy. Have it reviewed by a professional before launch.
const DOCS: Record<string, { title: string; sections: { h: string; b: string }[] }> = {
  terms: {
    title: "Terms of Service",
    sections: [
      { h: "Acceptance", b: "By creating an account or using Athos, you agree to these Terms. If you do not agree, do not use the app." },
      { h: "Your account", b: "You must provide accurate information and keep your password secure. You are responsible for activity on your account. You must be at least 13 years old to use Athos." },
      { h: "Acceptable use", b: "Athos has zero tolerance for objectionable content or abusive behavior. Do not post harassment, hate, explicit, illegal, or harmful content. You may report content and block users; we may remove content and suspend or ban accounts that violate these Terms." },
      { h: "Your content", b: "You keep ownership of the workouts, posts, photos, and messages you create, and grant Athos a license to store and display them so the app can function." },
      { h: "Not medical advice", b: "Athos provides general fitness tracking. It is not medical advice. Consult a professional before starting any training program." },
      { h: "Termination", b: "You can delete your account at any time in Settings. We may suspend or ban accounts that violate these Terms." },
      { h: "Limitation of liability", b: "Athos is provided \"as is\", without warranties of any kind. To the maximum extent permitted by law, we are not liable for indirect or incidental damages arising from your use of the app." },
      { h: "Changes", b: "We may update these Terms; continued use of Athos means you accept the changes." },
      { h: "Contact", b: "Questions about these Terms? Reach us from Settings → Help & Support." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { h: "What we collect", b: "Account info (email, username, display name), your training data (workouts, cardio, body stats), social content (posts, photos, comments, follows), and direct messages." },
      { h: "How we use it", b: "To run the app: show your feed and profile, track progress, deliver messages and notifications, and keep the community safe (handling reports and blocks)." },
      { h: "What we share", b: "We do not sell your personal data. Content you post publicly is visible to other users per your privacy settings. Service providers (e.g. database hosting) process data on our behalf." },
      { h: "Your controls", b: "You can edit your profile, set your account private, hide your followers, block users, and delete your account and data at any time from Settings." },
      { h: "Data retention", b: "We keep your data while your account is active. Deleting your account removes your account and associated data." },
      { h: "Security", b: "We protect your data with industry-standard measures, including password hashing and encrypted connections. No method is completely secure, so we cannot guarantee absolute security." },
      { h: "Children", b: "Athos is not directed to children under 13, and we do not knowingly collect their personal data." },
      { h: "Contact", b: "Questions about privacy? Reach us from Settings → Help & Support." },
    ],
  },
};

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();
  const content = DOCS[doc] || DOCS.terms;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="legal-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{content.title}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
          <Text style={styles.bannerText}>
            Starter template — have it reviewed and replace before publishing to the stores.
          </Text>
        </View>
        {content.sections.map((s, i) => (
          <View key={i} style={{ marginTop: spacing.lg }}>
            <Text style={styles.h}>{s.h}</Text>
            <Text style={styles.b}>{s.b}</Text>
          </View>
        ))}
        <Text style={styles.updated}>Last updated: June 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(200,154,58,0.10)", borderWidth: 1, borderColor: "rgba(200,154,58,0.30)",
    borderRadius: radius.md, padding: spacing.md,
  },
  bannerText: { flex: 1, color: "#E0C079", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  h: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 5 },
  b: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  updated: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xl, fontStyle: "italic" },
});
