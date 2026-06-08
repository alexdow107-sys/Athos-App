import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, ActivityIndicator, StyleSheet, Platform, Linking } from "react-native";
import * as ExpoLinking from "expo-linking";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { WorkoutProvider } from "@/src/context/WorkoutContext";
import { colors } from "@/src/theme";

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, googleSession } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Handle inbound auth deep link with session_id
  useEffect(() => {
    const processUrl = async (url: string | null) => {
      if (!url) return;
      try {
        // Web: session_id may be in hash
        let sid: string | null = null;
        if (url.includes("#session_id=")) {
          sid = url.split("#session_id=")[1].split("&")[0];
        } else {
          const parsed = ExpoLinking.parse(url);
          sid = (parsed.queryParams?.session_id as string) || null;
        }
        if (sid) {
          await googleSession(sid);
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      } catch (e) {
        console.warn("Auth deep-link error", e);
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      processUrl(window.location.href);
    } else {
      Linking.getInitialURL().then(processUrl);
      const sub = Linking.addEventListener("url", (e) => processUrl(e.url));
      return () => sub.remove();
    }
  }, [googleSession]);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "auth";
    const isIntro = segments[1] === "intro";
    const isOnboarding = segments[1] === "onboarding";

    if (!user && !inAuth) {
      router.replace("/auth/login");
    } else if (user && !user.onboarded && !isOnboarding && !isIntro) {
      // New user → show tour first, then onboarding
      router.replace("/auth/intro");
    } else if (user && user.onboarded && !user.seen_welcome_tour && !isIntro) {
      // Existing user who hasn't seen tour → show it once
      router.replace("/auth/intro");
    } else if (user && user.onboarded && user.seen_welcome_tour && inAuth) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <WorkoutProvider>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="workout/active" options={{ presentation: "modal" }} />
              <Stack.Screen name="workout/add-exercise" options={{ presentation: "modal" }} />
            </Stack>
          </AuthGate>
        </WorkoutProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
