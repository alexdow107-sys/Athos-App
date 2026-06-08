import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";

export default function GoogleSetupScreen() {
  const { user, googleCompleteSetup } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.username && !username) setUsername(user.username);
  }, [user?.username]);

  const onSubmit = async () => {
    setError(null);
    if (!username || !password) {
      setError("Please fill in both username and password");
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Password must be at least 8 characters and contain letters + a number");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await googleCompleteSetup({ username, password });
      router.replace("/auth/onboarding");
    } catch (e: any) {
      setError(e.message || "Could not complete setup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="google-setup-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>One last thing</Text>
          <Text style={styles.subtitle}>
            Pick a username and set a password so you can sign in with email too.
          </Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            testID="google-setup-username-input"
            value={username}
            onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
            placeholder="alexj"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.help}>3-20 characters. Letters, numbers and underscores only.</Text>

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="google-setup-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters, letters + number"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
          />

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            testID="google-setup-confirm-input"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
          />

          {error ? <Text style={styles.error} testID="google-setup-error">{error}</Text> : null}

          <View style={{ marginTop: spacing.lg }}>
            <Button
              testID="google-setup-submit-button"
              title="Continue"
              onPress={onSubmit}
              loading={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, marginTop: 6, fontSize: 14, lineHeight: 20 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: 16, color: colors.text,
    backgroundColor: colors.bg,
  },
  help: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 13, fontWeight: "600" },
});
