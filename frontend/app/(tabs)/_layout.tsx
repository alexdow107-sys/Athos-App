import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { View, Text, StyleSheet, AppState } from "react-native";
import { useWorkout } from "@/src/context/WorkoutContext";
import { api } from "@/src/api/client";

const TabIcon: React.FC<{ name: any; color: string; focused: boolean; testID?: string; badge?: number }> = ({ name, color, focused, testID, badge }) => (
  <View testID={testID} style={{ alignItems: "center", justifyContent: "center" }}>
    <Ionicons name={name} size={focused ? 27 : 24} color={color} />
    {badge && badge > 0 ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
      </View>
    ) : null}
    {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginTop: 3 }} />}
  </View>
);

// Polls unread notifications + messages so the Activity tab shows a live count.
function useActivityBadge(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [n, m] = await Promise.all([
          api<{ count: number }>("/notifications/unread-count").catch(() => ({ count: 0 })),
          api<{ count: number }>("/conversations/unread-count").catch(() => ({ count: 0 })),
        ]);
        if (alive) setCount((n.count || 0) + (m.count || 0));
      } catch {}
    };
    load();
    const iv = setInterval(load, 20000);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") load(); });
    return () => { alive = false; clearInterval(iv); sub.remove(); };
  }, []);
  return count;
}

const WorkoutTabIcon: React.FC<{ color: string; focused: boolean }> = ({ color, focused }) => {
  const { active } = useWorkout();
  return (
    <View testID="tab-workout" style={styles.workoutWrap}>
      <View style={[styles.workoutBubble, active && styles.workoutBubbleActive]}>
        <Ionicons name={active ? "barbell" : "add"} size={26} color={active ? "#fff" : "#fff"} />
      </View>
      {active ? <View style={styles.liveDot} /> : null}
    </View>
  );
};

export default function TabsLayout() {
  const activityBadge = useActivityBadge();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: "#1E2636",
          borderTopColor: "#212D42",
          borderTopWidth: 1,
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, focused }) => <TabIcon testID="tab-feed" name={focused ? "home" : "home-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) => <TabIcon testID="tab-discover" name={focused ? "compass" : "compass-outline"} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: "",
          tabBarIcon: ({ color, focused }) => <WorkoutTabIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Activity",
          tabBarIcon: ({ color, focused }) => <TabIcon testID="tab-notifications" name={focused ? "notifications" : "notifications-outline"} color={color} focused={focused} badge={activityBadge} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <TabIcon testID="tab-profile" name={focused ? "person-circle" : "person-circle-outline"} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute", top: -4, right: -10,
    minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8,
    backgroundColor: colors.danger, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  workoutWrap: { alignItems: "center", justifyContent: "center" },
  workoutBubble: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center", marginTop: -8,
    shadowColor: colors.brand, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  workoutBubbleActive: { backgroundColor: colors.danger },
  liveDot: {
    position: "absolute", top: -4, right: 10, width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.bg,
  },
});
