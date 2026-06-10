import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

type Goal = "strength" | "hypertrophy" | "weight_loss" | "endurance" | "athletic" | "general";
type Experience = "beginner" | "intermediate" | "advanced";
type Equipment = "full_gym" | "home_dumbbells" | "bodyweight";
type Gender = "male" | "female" | "unspecified";

const FOCUS_AREAS = [
  "Chest", "Back", "Shoulders", "Arms", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Cardio",
];

const DURATIONS = [30, 45, 60, 75, 90, 120];
const DAYS = [1, 2, 3, 4, 5, 6, 7];
const NOT_RECOMMENDED_DAYS = new Set([1, 7]);

const GOALS: { v: Goal; label: string; desc: string; icon: any }[] = [
  { v: "strength",    label: "Build Strength",        desc: "Heavy compound lifts, low rep range",   icon: "barbell"  },
  { v: "hypertrophy", label: "Hypertrophy",            desc: "Muscle size, 8–12 rep range",           icon: "fitness"  },
  { v: "weight_loss", label: "Lose Weight",            desc: "Cut fat while preserving muscle",       icon: "flame"    },
  { v: "endurance",   label: "Endurance",              desc: "Cardio capacity + muscular stamina",    icon: "pulse"    },
  { v: "athletic",    label: "Athletic Performance",   desc: "Power, agility, sport-specific",        icon: "trophy"   },
  { v: "general",     label: "General Fitness",        desc: "Stay healthy and strong overall",       icon: "leaf"     },
];

const EXP: { v: Experience; label: string; desc: string }[] = [
  { v: "beginner",     label: "Beginner",      desc: "Less than 6 months of consistent training" },
  { v: "intermediate", label: "Intermediate",  desc: "6 months to 2 years of lifting"            },
  { v: "advanced",     label: "Advanced",      desc: "2+ years training consistently"            },
];

const EQUIP: { v: Equipment; label: string; icon: any }[] = [
  { v: "full_gym",       label: "Full gym",              icon: "business" },
  { v: "home_dumbbells", label: "Home gym (DBs/bands)",  icon: "home"     },
  { v: "bodyweight",     label: "Bodyweight only",       icon: "body"     },
];

const GENDERS: { v: Gender; label: string; icon: any }[] = [
  { v: "male",        label: "Male",                icon: "man"             },
  { v: "female",      label: "Female",              icon: "woman"           },
  { v: "unspecified", label: "Prefer not to say",  icon: "person-outline"  },
];

export default function PlanQuestionnaireScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const prev = user?.plan_preferences || {};

  const [step, setStep]           = useState(0);
  const [gender, setGender]       = useState<Gender | null>(prev.gender ?? null);
  const [days, setDays]           = useState<number | null>(prev.days_per_week ?? user?.training_days_per_week ?? null);
  const [duration, setDuration]   = useState<number | null>(prev.session_duration_min ?? null);
  const [goal, setGoal]           = useState<Goal | null>(prev.primary_goal ?? null);
  const [experience, setExperience] = useState<Experience | null>(prev.experience_level ?? user?.experience_level as any ?? null);
  const [equipment, setEquipment] = useState<Equipment | null>(prev.equipment ?? null);
  const [focusAreas, setFocusAreas] = useState<string[]>(prev.focus_areas ?? []);
  const [preferences, setPreferences] = useState<string>((prev.injuries ?? "") + (prev.extra_notes ? "\n" + prev.extra_notes : ""));
  const [saving, setSaving]       = useState(false);

  const steps = [
    { key: "gender",    title: "What is your gender?",                           valid: !!gender                },
    { key: "days",      title: "How many days a week do you want to train?",     valid: !!days                  },
    { key: "duration",  title: "How long is each session?",                      valid: !!duration              },
    { key: "goal",      title: "What's your main goal?",                         valid: !!goal                  },
    { key: "experience",title: "What's your training experience?",               valid: !!experience            },
    { key: "equipment", title: "What equipment do you have access to?",          valid: !!equipment             },
    { key: "focus",     title: "Any body parts you want to prioritize?",         valid: true, optional: true    },
    { key: "prefs",     title: "Preferences, injuries, or anything else?",       valid: true, optional: true    },
  ];

  const totalSteps = steps.length;
  const current = steps[step];

  const toggleFocus = (a: string) => {
    setFocusAreas((cur) => cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]);
  };

  const onNext = async () => {
    if (step < totalSteps - 1) { setStep(step + 1); return; }
    setSaving(true);
    try {
      const prefs = {
        gender,
        days_per_week:       days,
        session_duration_min: duration,
        primary_goal:        goal,
        experience_level:    experience,
        equipment,
        focus_areas:         focusAreas,
        extra_notes:         preferences,
        injuries:            "",
        completed_at:        new Date().toISOString(),
      };
      await api("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          plan_preferences:      prefs,
          training_days_per_week: days,
          experience_level:       experience,
          main_goal:              goal === "weight_loss" ? "general" : goal,
        }),
      });
      await refresh();
      router.replace("/plan");
    } catch (e: any) {
      const msg = e?.message || "Try again";
      if (typeof window !== "undefined") window.alert(`Couldn't save: ${msg}`);
      else Alert.alert("Couldn't save", msg);
    } finally {
      setSaving(false);
    }
  };

  const onBack = () => {
    if (step === 0) router.back();
    else setStep(step - 1);
  };

  const renderStep = () => {
    switch (current.key) {
      case "gender":
        return (
          <View style={{ gap: 10 }}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.v}
                testID={`q-gender-${g.v}`}
                onPress={() => setGender(g.v)}
                style={[styles.option, gender === g.v && styles.optionActive]}
              >
                <View style={[styles.optionIcon, gender === g.v && { backgroundColor: colors.brand }]}>
                  <Ionicons name={g.icon} size={18} color={gender === g.v ? "#fff" : colors.brand} />
                </View>
                <Text style={[styles.optionTitle, { flex: 1 }]}>{g.label}</Text>
                {gender === g.v && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
              </TouchableOpacity>
            ))}
            <Text style={styles.helperText}>This helps personalise your glute and leg programming.</Text>
          </View>
        );

      case "days":
        return (
          <View>
            <View style={styles.grid}>
              {DAYS.map((d) => {
                const notRec = NOT_RECOMMENDED_DAYS.has(d);
                return (
                  <TouchableOpacity
                    key={d}
                    testID={`q-days-${d}`}
                    onPress={() => setDays(d)}
                    style={[styles.tile, days === d && styles.tileActive, notRec && styles.tileWarn]}
                  >
                    <Text style={[styles.tileNum, days === d && styles.tileTextActive]}>{d}</Text>
                    <Text style={[styles.tileSub, days === d && styles.tileTextActive]}>days/wk</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {days !== null && NOT_RECOMMENDED_DAYS.has(days) && (
              <View style={styles.warnBanner}>
                <Ionicons name="warning-outline" size={14} color="#B45309" />
                <Text style={styles.warnText}>
                  {days === 1
                    ? "Training once a week is the minimum effective dose. Results will be slow — consider 3×/week."
                    : "Training every day leaves no full rest days, limiting recovery. Only recommended for advanced athletes."}
                </Text>
              </View>
            )}
          </View>
        );

      case "duration":
        return (
          <View style={styles.grid}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                testID={`q-duration-${d}`}
                onPress={() => setDuration(d)}
                style={[styles.tile, duration === d && styles.tileActive]}
              >
                <Text style={[styles.tileNum, duration === d && styles.tileTextActive]}>{d}</Text>
                <Text style={[styles.tileSub, duration === d && styles.tileTextActive]}>min</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case "goal":
        return (
          <View style={{ gap: 10 }}>
            {GOALS.map((g) => (
              <TouchableOpacity
                key={g.v}
                testID={`q-goal-${g.v}`}
                onPress={() => setGoal(g.v)}
                style={[styles.option, goal === g.v && styles.optionActive]}
              >
                <View style={[styles.optionIcon, goal === g.v && { backgroundColor: colors.brand }]}>
                  <Ionicons name={g.icon} size={18} color={goal === g.v ? "#fff" : colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{g.label}</Text>
                  <Text style={styles.optionDesc}>{g.desc}</Text>
                </View>
                {goal === g.v && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
              </TouchableOpacity>
            ))}
          </View>
        );

      case "experience":
        return (
          <View style={{ gap: 10 }}>
            {EXP.map((e) => (
              <TouchableOpacity
                key={e.v}
                testID={`q-exp-${e.v}`}
                onPress={() => setExperience(e.v)}
                style={[styles.option, experience === e.v && styles.optionActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{e.label}</Text>
                  <Text style={styles.optionDesc}>{e.desc}</Text>
                </View>
                {experience === e.v && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
              </TouchableOpacity>
            ))}
          </View>
        );

      case "equipment":
        return (
          <View style={{ gap: 10 }}>
            {EQUIP.map((e) => (
              <TouchableOpacity
                key={e.v}
                testID={`q-equip-${e.v}`}
                onPress={() => setEquipment(e.v)}
                style={[styles.option, equipment === e.v && styles.optionActive]}
              >
                <View style={[styles.optionIcon, equipment === e.v && { backgroundColor: colors.brand }]}>
                  <Ionicons name={e.icon} size={18} color={equipment === e.v ? "#fff" : colors.brand} />
                </View>
                <Text style={[styles.optionTitle, { flex: 1 }]}>{e.label}</Text>
                {equipment === e.v && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
              </TouchableOpacity>
            ))}
          </View>
        );

      case "focus":
        return (
          <View>
            <Text style={styles.helperText}>Select as many as you like — or skip.</Text>
            <View style={styles.chipsWrap}>
              {FOCUS_AREAS.map((a) => {
                const on = focusAreas.includes(a);
                return (
                  <TouchableOpacity
                    key={a}
                    testID={`q-focus-${a}`}
                    onPress={() => toggleFocus(a)}
                    style={[styles.chip, on && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, on && { color: "#fff" }]}>{a}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case "prefs":
        return (
          <View>
            <Text style={styles.label}>Preferences, injuries, or limitations</Text>
            <TextInput
              testID="q-preferences"
              value={preferences}
              onChangeText={setPreferences}
              placeholder={
                "e.g. I want to focus on glutes, bad left knee (avoid deep squats), no overhead pressing, prefer machines over free weights..."
              }
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.textArea}
            />
            <Text style={styles.helperText}>
              The more detail you give, the more the plan is tailored to you.
            </Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="plan-questionnaire-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity testID="q-back" onPress={onBack} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerSub}>Step {step + 1} of {totalSteps}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%` as any }]} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{current.title}</Text>
          {(current as any).optional ? <Text style={styles.optional}>Optional</Text> : null}
          <View style={{ marginTop: spacing.lg }}>
            {renderStep()}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            testID="q-next"
            onPress={onNext}
            disabled={!current.valid || saving}
            style={[styles.cta, (!current.valid || saving) && { opacity: 0.5 }]}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>{step === totalSteps - 1 ? "Build my plan" : "Continue"}</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.sm },
  headerSub: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  iconBtn: { padding: 6, width: 40 },
  progressBar: { height: 4, backgroundColor: colors.bg2, marginHorizontal: spacing.lg, borderRadius: 2 },
  progressFill: { height: "100%", backgroundColor: colors.brand, borderRadius: 2 },
  title: { fontSize: 24, fontWeight: "900", color: colors.text, letterSpacing: -0.5, lineHeight: 30 },
  optional: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "700" },
  helperText: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 8 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "31%", aspectRatio: 1, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.bg,
  },
  tileActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  tileWarn:   { borderColor: "#F59E0B" },
  tileNum: { color: colors.text, fontSize: 28, fontWeight: "900" },
  tileSub: { color: colors.textMuted, fontSize: 10, marginTop: 4, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  tileTextActive: { color: "#fff" },

  warnBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: "rgba(200,154,58,0.10)", borderWidth: 1, borderColor: "rgba(200,154,58,0.30)",
  },
  warnText: { color: "#E0C079", fontSize: 12, lineHeight: 17, flex: 1, fontWeight: "600" },

  option: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  optionActive: { borderColor: colors.brand },
  optionIcon: { width: 38, height: 38, borderRadius: 9, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  optionTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  optionDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.text, fontWeight: "700", fontSize: 13 },

  label: { color: colors.textSecondary, fontWeight: "800", fontSize: 13, marginBottom: 6 },
  textArea: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 14, color: colors.text, minHeight: 100,
    textAlignVertical: "top", backgroundColor: colors.bg,
  },

  footer: {
    padding: spacing.lg, paddingBottom: Platform.OS === "ios" ? 24 : spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg,
  },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brand, paddingVertical: 16, borderRadius: radius.md,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
