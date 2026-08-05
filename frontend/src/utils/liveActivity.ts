/**
 * iOS Live Activity for the active workout — a ticking timer on the lock screen
 * and Dynamic Island. Shows the workout elapsed time, and switches to a rest
 * countdown while resting. No-ops on Android/web and on iOS < 16.2.
 *
 * Powered by expo-live-activity, which renders the widget UI for us (we only
 * push state), so there's no custom Swift to maintain.
 */
import { Platform } from "react-native";

type LA = typeof import("expo-live-activity");
let mod: LA | null = null;
if (Platform.OS === "ios") {
  try {
    mod = require("expo-live-activity");
  } catch {
    mod = null;
  }
}

let activityId: string | undefined;

const CONFIG = {
  backgroundColor: "#000000",
  titleColor: "#F0F0F0",
  subtitleColor: "#8CA3BE",
  progressViewTint: "#6BC5DE",
  progressViewLabelColor: "#FFFFFF",
  timerType: "digital" as const,
  deepLinkUrl: "/workout/active",
};

/** Start the Live Activity when a workout begins. */
export function startWorkoutActivity(name: string, startedAtMs: number) {
  if (!mod || activityId) return;
  try {
    activityId = mod.startActivity(
      {
        title: name || "Workout",
        subtitle: "Workout in progress",
        progressBar: { elapsedTimer: { startDate: startedAtMs } },
      },
      CONFIG,
    ) || undefined;
  } catch {}
}

/** Switch the activity to a rest countdown (ends at restEndsAtMs). */
export function showRestOnActivity(name: string, restEndsAtMs: number) {
  if (!mod || !activityId) return;
  try {
    mod.updateActivity(activityId, {
      title: name || "Workout",
      subtitle: "Resting",
      progressBar: { date: restEndsAtMs },
    });
  } catch {}
}

/** Switch the activity back to the running workout timer. */
export function showWorkoutOnActivity(name: string, startedAtMs: number) {
  if (!mod || !activityId) return;
  try {
    mod.updateActivity(activityId, {
      title: name || "Workout",
      subtitle: "Workout in progress",
      progressBar: { elapsedTimer: { startDate: startedAtMs } },
    });
  } catch {}
}

/** End the Live Activity when the workout finishes or is discarded. */
export function endWorkoutActivity(name?: string, startedAtMs?: number) {
  if (!mod || !activityId) return;
  try {
    mod.stopActivity(activityId, {
      title: name || "Workout",
      subtitle: "Complete",
      progressBar: startedAtMs ? { elapsedTimer: { startDate: startedAtMs } } : { progress: 1 },
    });
  } catch {}
  activityId = undefined;
}
