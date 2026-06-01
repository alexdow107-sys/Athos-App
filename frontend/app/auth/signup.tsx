import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";

export default function SignupScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password || !username || !displayName) {
      setError("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        username: username.trim(),
        display_name: displayName.trim(),
      });
      router.replace("/auth/onboarding");
    } catch (e: any) {
      setError(e.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="signup-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join the community of serious lifters</Text>

          <Text style={styles.label}>Display name</Text>
          <TextInput
            testID="signup-displayname-input"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Alex Johnson"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            testID="signup-username-input"
            value={username}
            onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
            placeholder="alexj"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="signup-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="signup-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
          />

          {error ? <Text style={styles.error} testID="signup-error">{error}</Text> : null}

          <View style={{ marginTop: spacing.lg }}>
            <Button testID="signup-submit-button" title="Create account" onPress={onSubmit} loading={loading} />
          </View>

          <View style={styles.row}>
            <Text style={styles.muted}>Already have an account? </Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Sign in</Text>
              </TouchableOpacity>
            </Link>
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
  subtitle: { color: colors.textMuted, marginTop: 4, fontSize: 14 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: 16, color: colors.text,
    backgroundColor: colors.bg,
  },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  muted: { color: colors.textMuted },
  linkText: { color: colors.brand, fontWeight: "700" },
});
