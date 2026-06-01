import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";

export default function OnboardingScreen() {
  const { refresh } = useAuth();
  const router = useRouter();
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft_in">("cm");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [dob, setDob] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async () => {
    setError(null);
    setLoading(true);
    try {
      await api("/users/onboard", {
        method: "POST",
        body: JSON.stringify({
          date_of_birth: dob || null,
          age: age ? parseInt(age, 10) : null,
          height_unit: heightUnit,
          weight_unit: weightUnit,
          height: height ? parseFloat(height) : null,
          weight: weight ? parseFloat(weight) : null,
          is_private: isPrivate,
        }),
      });
      await refresh();
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const Choice: React.FC<{ active: boolean; label: string; onPress: () => void; testID?: string }> = ({ active, label, onPress, testID }) => (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.choice, active && styles.choiceActive]}
    >
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} testID="onboarding-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome to Atho</Text>
          <Text style={styles.subtitle}>Let's set up your training profile</Text>

          <Text style={styles.section}>Units</Text>
          <Text style={styles.label}>Weight</Text>
          <View style={styles.row}>
            <Choice testID="weight-unit-kg" active={weightUnit === "kg"} label="Kilograms (kg)" onPress={() => setWeightUnit("kg")} />
            <Choice testID="weight-unit-lb" active={weightUnit === "lb"} label="Pounds (lb)" onPress={() => setWeightUnit("lb")} />
          </View>
          <Text style={styles.label}>Height</Text>
          <View style={styles.row}>
            <Choice testID="height-unit-cm" active={heightUnit === "cm"} label="Centimeters" onPress={() => setHeightUnit("cm")} />
            <Choice testID="height-unit-ft" active={heightUnit === "ft_in"} label="Feet & inches" onPress={() => setHeightUnit("ft_in")} />
          </View>

          <Text style={styles.section}>Body</Text>
          <Text style={styles.label}>Height ({heightUnit === "cm" ? "cm" : "in"})</Text>
          <TextInput
            testID="onboarding-height-input"
            value={height} onChangeText={setHeight}
            placeholder={heightUnit === "cm" ? "175" : "70"}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric" style={styles.input}
          />
          <Text style={styles.label}>Current body weight ({weightUnit})</Text>
          <TextInput
            testID="onboarding-weight-input"
            value={weight} onChangeText={setWeight}
            placeholder={weightUnit === "kg" ? "75" : "165"}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric" style={styles.input}
          />

          <Text style={styles.section}>About you</Text>
          <Text style={styles.label}>Age</Text>
          <TextInput
            testID="onboarding-age-input"
            value={age} onChangeText={setAge}
            placeholder="25" placeholderTextColor={colors.textMuted}
            keyboardType="numeric" style={styles.input}
          />
          <Text style={styles.label}>Date of birth (YYYY-MM-DD, optional)</Text>
          <TextInput
            testID="onboarding-dob-input"
            value={dob} onChangeText={setDob}
            placeholder="2000-01-15" placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <View style={styles.privacyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyTitle}>Private account</Text>
              <Text style={styles.privacySubtitle}>Approve who follows you and sees your workouts</Text>
            </View>
            <Switch
              testID="onboarding-private-switch"
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ true: colors.brand, false: colors.border }}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
            <Button testID="onboarding-finish-button" title="Start training" onPress={onFinish} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, marginTop: 4, fontSize: 14 },
  section: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1.2, marginTop: spacing.xl, marginBottom: spacing.sm, textTransform: "uppercase" },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: 16, color: colors.text,
    backgroundColor: colors.bg,
  },
  row: { flexDirection: "row", gap: 8 },
  choice: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 12, alignItems: "center", marginRight: 8,
  },
  choiceActive: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  choiceText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  choiceTextActive: { color: colors.brand, fontWeight: "800" },
  privacyRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.lg },
  privacyTitle: { color: colors.text, fontWeight: "700", fontSize: 15 },
  privacySubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 13, fontWeight: "600" },
});
