import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/Button";
import { colors, spacing } from "@/src/theme";

export default function SubscriptionSuccessScreen() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (session_id) {
          await api(`/subscription/verify?session_id=${session_id}`);
        }
        await refresh();
        setVerified(true);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [session_id, refresh]);

  return (
    <SafeAreaView style={styles.safe} testID="subscription-success-screen">
      <View style={styles.center}>
        {!verified && !error ? (
          <>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.text}>Verifying your subscription...</Text>
          </>
        ) : error ? (
          <>
            <Ionicons name="alert-circle" size={64} color={colors.danger} />
            <Text style={styles.title}>Verification failed</Text>
            <Text style={styles.text}>{error}</Text>
            <Button title="Go back" onPress={() => router.replace("/(tabs)")} />
          </>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={styles.title}>Welcome to Premium</Text>
            <Text style={styles.text}>AI insights, plateau detection, and advanced analytics are now unlocked.</Text>
            <Button testID="success-continue-btn" title="Explore analytics" onPress={() => router.replace("/analytics")} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { fontSize: 24, fontWeight: "900", color: colors.text, marginTop: spacing.md, textAlign: "center" },
  text: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 8, marginBottom: spacing.xl, paddingHorizontal: 24 },
});
