// Common formatters
export const fmtDuration = (sec: number): string => {
  if (!sec || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const fmtVolume = (v: number, unit = "kg"): string => {
  if (!v) return `0 ${unit}`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(v)} ${unit}`;
};

export const fmtRelative = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const w = Math.floor(day / 7);
  if (w < 4) return `${w}w`;
  return d.toLocaleDateString();
};

export const fmtDate = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/**
 * Today's date (or a given date) as YYYY-MM-DD in the device's LOCAL timezone.
 *
 * Use this instead of `new Date().toISOString().slice(0, 10)` — `toISOString()`
 * returns the UTC date, which lands on the wrong day for users behind/ahead of
 * UTC (e.g. an evening workout in the Americas gets stored as the next day).
 */
export const localDateStr = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const KM_TO_MI = 0.621371;

/** Format a distance stored in km, displaying in the user's preferred unit. */
export const fmtDistance = (km: number | null | undefined, unit: "km" | "mi" = "km"): string => {
  if (km == null) return "";
  if (unit === "mi") {
    const mi = km * KM_TO_MI;
    return `${mi < 10 ? mi.toFixed(2) : mi.toFixed(1)} mi`;
  }
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
};

/** Convert a user-entered distance value to km for storage. */
export const toKm = (value: number, unit: "km" | "mi"): number =>
  unit === "mi" ? value / KM_TO_MI : value;

/** Convert a stored km value to the display unit. */
export const fromKm = (km: number, unit: "km" | "mi"): number =>
  unit === "mi" ? km * KM_TO_MI : km;

/** Format pace (duration in seconds, distance in km) as min/km or min/mi. */
export const fmtPace = (durationSec: number, distanceKm: number, unit: "km" | "mi" = "km"): string => {
  if (!distanceKm || !durationSec) return "";
  const distInUnit = unit === "mi" ? distanceKm * KM_TO_MI : distanceKm;
  const minPerUnit = durationSec / 60 / distInUnit;
  const m = Math.floor(minPerUnit);
  const s = Math.round((minPerUnit - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /${unit}`;
};

export const initials = (name: string): string => {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
};
