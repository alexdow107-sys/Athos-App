import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      // login() updates context user; route based on flags
      // We have to read fresh user; fall back to redirect to index which handles routing
      router.replace("/");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.headerWrap}>
            <Text style={styles.logo}>Athos</Text>
            <Text style={styles.subtitle}>Train. Track. Triumph.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={styles.input}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
            />

            {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

            <View style={{ marginTop: spacing.lg }}>
              <Button testID="login-submit-button" title="Sign in" onPress={onLogin} loading={loading} />
            </View>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>New to Athos? </Text>
              <Link href="/auth/signup" asChild>
                <TouchableOpacity testID="goto-signup-link">
                  <Text style={styles.signupLink}>Create account</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xxl },
  headerWrap: { alignItems: "center", marginBottom: spacing.xxl, marginTop: spacing.xl },
  logo: { fontSize: 56, fontWeight: "900", color: colors.brand, letterSpacing: -2 },
  subtitle: { color: colors.textMuted, marginTop: 4, fontSize: 14, fontWeight: "600", letterSpacing: 0.5 },
  form: { width: "100%" },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: 16, color: colors.text,
    backgroundColor: colors.bg,
  },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 13, fontWeight: "600" },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  signupText: { color: colors.textMuted, fontSize: 14 },
  signupLink: { color: colors.brand, fontSize: 14, fontWeight: "700" },
});
