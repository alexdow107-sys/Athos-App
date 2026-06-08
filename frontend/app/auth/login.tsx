import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { Logo } from "@/src/components/Logo";
import { colors, radius, spacing } from "@/src/theme";

export default function LoginScreen() {
  const { login, googleSession } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      // Only on signup path — login path is more lenient; only block obvious short ones
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const redirectUrl = Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("auth");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        let sid: string | null = null;
        if (result.url.includes("#session_id=")) {
          sid = result.url.split("#session_id=")[1].split("&")[0];
        } else {
          const parsed = Linking.parse(result.url);
          sid = (parsed.queryParams?.session_id as string) || null;
        }
        if (sid) {
          await googleSession(sid);
          router.replace("/(tabs)");
        } else {
          setError("Google sign-in failed");
        }
      }
    } catch (e: any) {
      setError(e.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
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
            <Logo size={64} />
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

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              testID="login-google-button"
              style={styles.googleBtn}
              onPress={onGoogle}
              disabled={googleLoading}
              activeOpacity={0.7}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

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
  divider: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: 12, color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  googleBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 13, alignItems: "center", justifyContent: "center", flexDirection: "row",
  },
  googleG: { fontSize: 18, fontWeight: "900", color: "#4285F4", marginRight: 10 },
  googleText: { fontSize: 15, fontWeight: "700", color: colors.text },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  signupText: { color: colors.textMuted, fontSize: 14 },
  signupLink: { color: colors.brand, fontSize: 14, fontWeight: "700" },
});
