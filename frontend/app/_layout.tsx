import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { WorkoutProvider } from "@/src/context/WorkoutContext";
import { colors } from "@/src/theme";

SplashScreen.preventAutoHideAsync();

// Handles tapping an Athos notification → opens the target screen.
function NotificationTapHandler() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;
    let Notifications: typeof import("expo-notifications") | null = null;
    try { Notifications = require("expo-notifications"); } catch {}
    if (!Notifications) return;

    // Cold-launch: was the app opened by tapping a notification?
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const screen = response?.notification?.request?.content?.data?.screen as string | undefined;
      if (screen) router.replace(screen as any);
    });

    // While app is running in background/foreground
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      if (screen) router.replace(screen as any);
    });
    return () => sub.remove();
  }, [router]);

  return null;
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
      <StatusBar style="light" />
      <AuthProvider>
        <WorkoutProvider>
          <NotificationTapHandler />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workout/active" options={{ presentation: "modal" }} />
            <Stack.Screen name="workout/add-exercise" options={{ presentation: "modal" }} />
            <Stack.Screen name="workout/add-cardio" options={{ presentation: "modal" }} />
            <Stack.Screen name="workout/edit-cardio" options={{ presentation: "modal" }} />
            <Stack.Screen name="workout/save-cardio" options={{ presentation: "modal" }} />
          </Stack>
        </WorkoutProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
