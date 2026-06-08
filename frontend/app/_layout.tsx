import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, Linking } from "react-native";
import * as ExpoLinking from "expo-linking";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { WorkoutProvider } from "@/src/context/WorkoutContext";
import { colors } from "@/src/theme";

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { googleSession } = useAuth();

  // Handle inbound auth deep link with session_id
  useEffect(() => {
    const processUrl = async (url: string | null) => {
      if (!url) return;
      try {
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
