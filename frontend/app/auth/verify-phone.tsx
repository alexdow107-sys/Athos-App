import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { colors, radius, spacing } from "@/src/theme";

export default function VerifyPhone() {
  const router = useRouter();
  const { phone, dev_code } = useLocalSearchParams<{ phone: string; dev_code?: string }>();
  const { refresh } = useAuth();
  const [code, setCode] = useState((dev_code as string) || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>((dev_code as string) || null);

  const onVerify = async () => {
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await api("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      });
      await refresh();
      router.replace("/auth/intro");
    } catch (e: any) {
      setError(e.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await r.json();
      setLastSent(d.dev_code);
      Alert.alert("Code resent", `Dev code: ${d.dev_code}`);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="verify-phone-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="phone-portrait" size={32} color={colors.brand} />
          </View>
          <Text style={styles.title}>Verify your phone</Text>
          <Text style={styles.subtitle}>We sent a 6-digit code to {phone}</Text>

          {lastSent ? (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>DEV MODE — auto-filled code</Text>
              <Text style={styles.devCode}>{lastSent}</Text>
            </View>
          ) : null}

          <TextInput
            testID="otp-input"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={styles.otpInput}
            maxLength={6}
            autoFocus
          />

          {error ? <Text style={styles.error} testID="otp-error">{error}</Text> : null}

          <View style={{ marginTop: spacing.xl, width: "100%" }}>
            <Button testID="verify-otp-btn" title="Verify and continue" onPress={onVerify} loading={loading} />
          </View>

          <TouchableOpacity testID="resend-otp-btn" onPress={onResend} disabled={resending} style={styles.resendBtn}>
            <Text style={styles.resendText}>{resending ? "Resending..." : "Didn't get a code? Resend"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", padding: spacing.sm, justifyContent: "space-between" },
  iconBtn: { padding: 6 },
  content: { flex: 1, padding: spacing.xl, alignItems: "center" },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "900", color: colors.text, marginTop: spacing.md, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 4, textAlign: "center" },
  devBox: { backgroundColor: "#FEF3C7", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.xl, alignItems: "center", width: "100%" },
  devLabel: { color: "#92400E", fontWeight: "900", fontSize: 10, letterSpacing: 1 },
  devCode: { color: "#92400E", fontWeight: "900", fontSize: 24, letterSpacing: 4, marginTop: 4 },
  otpInput: { fontSize: 32, fontWeight: "900", color: colors.text, letterSpacing: 8, textAlign: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginTop: spacing.xl, width: "100%" },
  error: { color: colors.danger, marginTop: spacing.md, fontWeight: "600" },
  resendBtn: { marginTop: spacing.lg, padding: 10 },
  resendText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
});
