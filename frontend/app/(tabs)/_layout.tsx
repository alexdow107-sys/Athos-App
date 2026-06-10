import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { View, Text, StyleSheet } from "react-native";
import { useWorkout } from "@/src/context/WorkoutContext";

const TabIcon: React.FC<{ name: any; color: string; focused: boolean; testID?: string }> = ({ name, color, focused, testID }) => (
  <View testID={testID} style={{ alignItems: "center", justifyContent: "center" }}>
    <Ionicons name={name} size={focused ? 27 : 24} color={color} />
    {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginTop: 3 }} />}
  </View>
);

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
          tabBarIcon: ({ color, focused }) => <TabIcon testID="tab-notifications" name={focused ? "notifications" : "notifications-outline"} color={color} focused={focused} />,
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
