import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "@/src/theme";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Atho</Text>
      <Text style={styles.tagline}>Train. Track. Triumph.</Text>
      <ActivityIndicator color={colors.brand} style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  logo: { fontSize: 48, fontWeight: "900", color: colors.brand, letterSpacing: -1.5 },
  tagline: { fontSize: 14, color: colors.textMuted, marginTop: 4, fontWeight: "600" },
});
