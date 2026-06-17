/**
 * Workout lock-screen notification service.
 *
 * What this does:
 *  - Shows a persistent notification while a workout is active (name + elapsed time).
 *  - When a rest timer starts: updates the notification to show the countdown
 *    and schedules a separate "Rest over" alert that fires precisely at the end.
 *  - When the workout ends or is discarded: cancels everything.
 *
 * Limitations (managed Expo, no native extensions):
 *  - The display refreshes about every 15 s for elapsed time and every ~5 s while
 *    resting, but only while the app is in the foreground (JS timers are suspended
 *    in the background). It won't tick second-by-second on a locked screen — that
 *    requires iOS Live Activities or an Android foreground service, both of which
 *    need a custom native build (planned as a follow-up).
 *  - The rest "Rest over" notification fires at exactly the right time because it is
 *    scheduled as a future local notification, which the OS delivers even when the app
 *    is in the background.
 */

import { Platform } from "react-native";

// Lazy-import so the module is never required on web (where it errors).
let Notifications: typeof import("expo-notifications") | null = null;
if (Platform.OS !== "web") {
  try {
    Notifications = require("expo-notifications");
  } catch {
    Notifications = null;
  }
}

// Notification identifiers
const ID_WORKOUT  = "athos-workout-active";
const ID_REST_END = "athos-rest-end";

// ── Foreground handler ────────────────────────────────────────────────────────

// Show notification even when the app is open (lets the lock-screen entry persist
// even if the user briefly returns to the app).
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification: any) => {
      // The persistent timer notification stays silent; the "rest over" alert
      // gets a sound + banner even when the app is open (e.g. on another screen).
      const isRestEnd = notification.request.identifier === ID_REST_END;
      return {
        shouldShowAlert:   isRestEnd,  // legacy key (older SDKs)
        shouldPlaySound:   isRestEnd,
        shouldSetBadge:    false,
        shouldShowBanner:  isRestEnd,
        shouldShowList:    true,
      };
    },
  });
}

// ── Android notification channel ─────────────────────────────────────────────

export async function ensureChannel() {
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("workout", {
    name:               "Workout Tracking",
    description:        "Live workout timer and rest countdown on your lock screen.",
    importance:         Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern:   [],
    enableVibrate:      false,
    showBadge:          false,
  });
}

// ── Permissions ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications || Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s < 10 ? "0" + s : s}s`;
  return `${s}s`;
}

function fmtRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s < 10 ? "0" + s : s}` : `${s}s`;
}

// ── Core notification helpers ─────────────────────────────────────────────────

async function cancelById(id: string) {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.dismissNotificationAsync(id).catch(() => {});
}

async function present(id: string, title: string, body: string) {
  if (!Notifications) return;
  await cancelById(id);
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title,
      body,
      data:    { screen: "/workout/active" },
      sound:   false,
      sticky:  true,    // Android: keeps notification in tray
      autoDismiss: false,
      ...(Platform.OS === "android" && {
        channelId:           "workout",
        priority:            "high",
        color:               "#6366F1",
        smallIcon:           "ic_notification",
        ongoing:             true,    // not dismissible by swipe on Android
        showWhenCollapsed:   false,
      }),
    },
    trigger: null, // fire immediately
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Show (or refresh) the persistent workout notification.
 * Call this when the workout starts and approximately every 60 s.
 */
export async function showWorkoutNotification(params: {
  workoutName: string;
  elapsedSeconds: number;
  exerciseCount: number;
}) {
  if (!Notifications || Platform.OS === "web") return;
  const title = `Athos · ${params.workoutName}`;
  const body  = `${fmtElapsed(params.elapsedSeconds)} · ${params.exerciseCount} exercise${params.exerciseCount !== 1 ? "s" : ""}  —  tap to log`;
  await present(ID_WORKOUT, title, body);
}

/**
 * Update the workout notification to show an active rest timer.
 * Call this immediately when rest starts.
 */
export async function showRestNotification(params: {
  workoutName: string;
  elapsedSeconds: number;
  restRemaining: number;
}) {
  if (!Notifications || Platform.OS === "web") return;
  const title = `Rest: ${fmtRest(params.restRemaining)} remaining`;
  const body  = `${params.workoutName} · ${fmtElapsed(params.elapsedSeconds)} in — tap to log`;
  await present(ID_WORKOUT, title, body);
}

/**
 * Schedule a precise "rest is over" notification that fires at restEndMs.
 * Replaces any existing rest-end notification.
 */
export async function scheduleRestEndNotification(params: {
  workoutName: string;
  restEndMs: number;  // unix timestamp in ms
}) {
  if (!Notifications || Platform.OS === "web") return;
  await cancelById(ID_REST_END);
  const secondsUntilEnd = Math.max(1, Math.round((params.restEndMs - Date.now()) / 1000));
  await Notifications.scheduleNotificationAsync({
    identifier: ID_REST_END,
    content: {
      title: "Rest over — get back to it!",
      body:  `${params.workoutName} is waiting.`,
      data:  { screen: "/workout/active" },
      sound: true,
      ...(Platform.OS === "android" && { channelId: "workout", priority: "high", color: "#6366F1" }),
    },
    trigger: { type: "timeInterval", seconds: secondsUntilEnd, repeats: false } as any,
  });
}

/**
 * Cancel the pending "rest over" notification (e.g. user skipped rest early).
 */
export async function cancelRestEndNotification() {
  if (!Notifications || Platform.OS === "web") return;
  await cancelById(ID_REST_END);
}

/**
 * Remove all workout notifications. Call on workout finish or cancel.
 */
export async function clearWorkoutNotifications() {
  if (!Notifications || Platform.OS === "web") return;
  await cancelById(ID_WORKOUT);
  await cancelById(ID_REST_END);
}
