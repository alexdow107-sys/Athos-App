import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import DateTimePicker from "@react-native-community/datetimepicker";

import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";

const MAIN_GOALS = [
  { key: "strength", label: "Strength", icon: "🏋️" },
  { key: "hypertrophy", label: "Hypertrophy", icon: "💪" },
  { key: "calisthenics", label: "Calisthenics", icon: "🤸" },
  { key: "general", label: "General fitness", icon: "🔥" },
];
const WEIGHT_GOALS = [
  { key: "lose", label: "Lose weight" },
  { key: "maintain", label: "Maintain" },
  { key: "gain", label: "Gain muscle" },
];

export default function OnboardingScreen() {
  const { refresh } = useAuth();
  const router = useRouter();
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft_in">("cm");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [trainingDays, setTrainingDays] = useState<number | null>(null);
  const [mainGoal, setMainGoal] = useState<string | null>(null);
  const [weightGoal, setWeightGoal] = useState<string | null>(null);
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
          date_of_birth: dob ? dob.toISOString().split("T")[0] : null,
          age: dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : (age ? parseInt(age, 10) : null),
          height_unit: heightUnit,
          weight_unit: weightUnit,
          height: height ? parseFloat(height) : null,
          weight: weight ? parseFloat(weight) : null,
          is_private: isPrivate,
        }),
      });
      // Save goals too if provided
      if (trainingDays || mainGoal || weightGoal) {
        try {
          await api("/users/goals", {
            method: "POST",
            body: JSON.stringify({
              training_days_per_week: trainingDays,
              main_goal: mainGoal,
              weight_goal: weightGoal,
            }),
          });
        } catch {}
      }
      await refresh();
      router.replace("/auth/intro");
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
          <Text style={styles.title}>Welcome to Athos</Text>
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
          <Text style={styles.label}>Date of birth</Text>
          <TouchableOpacity
            testID="onboarding-dob-btn"
            onPress={() => setShowDatePicker(true)}
            style={[styles.input, { justifyContent: "center" }]}
          >
            <Text style={{ color: dob ? colors.text : colors.textMuted, fontSize: 16 }}>
              {dob ? dob.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Tap to choose your birthday"}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              testID="onboarding-dob-picker"
              value={dob || new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              minimumDate={new Date(1920, 0, 1)}
              onChange={(_, d) => {
                if (Platform.OS !== "ios") setShowDatePicker(false);
                if (d) setDob(d);
              }}
            />
          )}
          {Platform.OS === "ios" && showDatePicker && (
            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.dobDone}>
              <Text style={styles.dobDoneText}>Done</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.section}>Training goals</Text>
          <Text style={styles.label}>Days per week</Text>
          <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>
            {[2, 3, 4, 5, 6].map((d) => (
              <TouchableOpacity
                key={d}
                testID={`days-${d}`}
                onPress={() => setTrainingDays(d)}
                style={[styles.daysChip, trainingDays === d && styles.daysChipActive]}
              >
                <Text style={[styles.daysText, trainingDays === d && styles.daysTextActive]}>{d}×</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Main goal</Text>
          <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>
            {MAIN_GOALS.map((g) => (
              <TouchableOpacity
                key={g.key}
                testID={`goal-${g.key}`}
                onPress={() => setMainGoal(g.key)}
                style={[styles.goalChip, mainGoal === g.key && styles.choiceActive]}
              >
                <Text style={[styles.goalText, mainGoal === g.key && styles.choiceTextActive]}>{g.icon}  {g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Weight goal</Text>
          <View style={styles.row}>
            {WEIGHT_GOALS.map((g) => (
              <Choice
                key={g.key}
                testID={`wgoal-${g.key}`}
                active={weightGoal === g.key}
                label={g.label}
                onPress={() => setWeightGoal(g.key)}
              />
            ))}
          </View>

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
  daysChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.bg3 },
  daysChipActive: { backgroundColor: colors.brand },
  daysText: { color: colors.text, fontWeight: "800", fontSize: 14 },
  daysTextActive: { color: "#fff" },
  goalChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  goalText: { color: colors.textSecondary, fontWeight: "700", fontSize: 13 },
  dobDone: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 8 },
  dobDoneText: { color: colors.brand, fontWeight: "800" },
  privacyRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.bg2, borderRadius: radius.lg },
  privacyTitle: { color: colors.text, fontWeight: "700", fontSize: 15 },
  privacySubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 13, fontWeight: "600" },
});
