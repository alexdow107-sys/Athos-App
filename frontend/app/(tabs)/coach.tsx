import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/src/theme";

export default function CoachScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="coach-screen">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Coach</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.badge}>
          <Ionicons name="ribbon" size={42} color={colors.brand} />
        </View>
        <Text style={styles.title}>Coach Mode</Text>
        <Text style={styles.tag}>Coming soon</Text>
        <Text style={styles.desc}>
          Author your own multi-week programs, share them with athletes, and
          earn from your training expertise. Premium subscribers will get
          early access.
        </Text>

        <View style={styles.cardList}>
          <View style={styles.card}>
            <View style={styles.cardIcon}><Ionicons name="document-text" size={18} color={colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Build a program</Text>
              <Text style={styles.cardDesc}>Design 4-12 week splits with sets, reps, and tempo.</Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.cardIcon}><Ionicons name="storefront" size={18} color={colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Sell or share</Text>
              <Text style={styles.cardDesc}>Publish to your followers or list in the marketplace.</Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.cardIcon}><Ionicons name="pulse" size={18} color={colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Track results</Text>
              <Text style={styles.cardDesc}>See aggregate progress for every athlete on your plan.</Text>
            </View>
          </View>
        </View>

        <View style={styles.notify}>
          <Ionicons name="sparkles" size={16} color={colors.brand} />
          <Text style={styles.notifyText}>We’ll let you know the second this drops.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  body: { padding: spacing.lg, alignItems: "center" },
  badge: {
    width: 80, height: 80, borderRadius: 20, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center", marginTop: spacing.xl,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", marginTop: spacing.lg, letterSpacing: -0.6 },
  tag: {
    backgroundColor: colors.brand, color: "#fff", fontWeight: "800", fontSize: 11,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginTop: 6, letterSpacing: 0.5,
  },
  desc: { color: colors.textSecondary, fontSize: 14, textAlign: "center", marginTop: spacing.md, lineHeight: 21, maxWidth: 360 },
  cardList: { width: "100%", maxWidth: 420, marginTop: spacing.xl, gap: spacing.sm },
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: colors.bg2, padding: spacing.md, borderRadius: radius.lg,
  },
  cardIcon: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  cardDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  notify: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: spacing.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.bg,
  },
  notifyText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
});
