/**
 * Thin, platform-safe wrapper around expo-haptics.
 *
 * Haptics only exist on iOS/Android. On web (and if the native module ever fails
 * to load) every call is a silent no-op, so callers never need their own guards.
 */
import { Platform } from "react-native";

let Haptics: typeof import("expo-haptics") | null = null;
if (Platform.OS !== "web") {
  try {
    Haptics = require("expo-haptics");
  } catch {
    Haptics = null;
  }
}

/** Light tap — e.g. completing a set. */
export function hapticLight() {
  if (!Haptics) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium tap — e.g. a more significant confirm. */
export function hapticMedium() {
  if (!Haptics) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Celebratory success buzz — e.g. hitting a PR. */
export function hapticSuccess() {
  if (!Haptics) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Subtle selection tick — e.g. toggling an option. */
export function hapticSelection() {
  if (!Haptics) return;
  Haptics.selectionAsync().catch(() => {});
}
