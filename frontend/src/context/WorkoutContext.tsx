import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { AppState } from "react-native";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api/client";
import { hapticLight } from "@/src/utils/haptics";
import { localDateStr } from "@/src/utils/format";
import {
  ensureChannel,
  requestNotificationPermission,
  showWorkoutNotification,
  showRestNotification,
  scheduleRestEndNotification,
  cancelRestEndNotification,
  clearWorkoutNotifications,
} from "@/src/utils/workoutNotification";

export interface SetData {
  weight?: number;
  reps?: number;
  left_weight?: number;
  left_reps?: number;
  right_weight?: number;
  right_reps?: number;
  completed: boolean;
  rpe?: number;
  notes?: string;
}

export interface LoggedExercise {
  exercise_id: string;
  exercise_name: string;
  is_unilateral: boolean;
  machine?: string | null;
  notes?: string;
  sets: SetData[];
  rest_seconds: number;
}

export interface ActiveWorkout {
  workout_id: string;
  name: string;
  notes?: string;
  exercises: LoggedExercise[];
  started_at: string;
}

const ACTIVE_KEY = "atho_active_workout";
const REST_KEY = "atho_rest_timer";

interface RestTimer {
  duration: number;          // chosen rest length (seconds)
  remaining: number;         // seconds left (authoritative when paused)
  running: boolean;
  end_at: number | null;     // wall-clock target while running
}

interface WorkoutCtx {
  active: ActiveWorkout | null;
  elapsed: number;
  restRemaining: number;
  restDuration: number;
  restRunning: boolean;
  startWorkout: (name?: string) => Promise<ActiveWorkout>;
  startWorkoutFromRoutine: (routine: { name: string; exercises: any[] }) => Promise<ActiveWorkout>;
  finishWorkout: (extras?: { caption?: string; photos?: string[]; visibility?: "public" | "private"; name?: string }) => Promise<any>;
  cancelWorkout: () => Promise<void>;
  addExercise: (ex: { exercise_id: string; exercise_name: string; is_unilateral: boolean; machine?: string | null }) => void;
  removeExercise: (index: number) => void;
  updateExercise: (index: number, updates: Partial<LoggedExercise>) => void;
  addSet: (exIndex: number) => void;
  removeSet: (exIndex: number, setIndex: number) => void;
  updateSet: (exIndex: number, setIndex: number, updates: Partial<SetData>) => void;
  completeSet: (exIndex: number, setIndex: number) => void;
  setRestDuration: (seconds: number) => void;
  startRest: () => void;
  pauseRest: () => void;
  resetRest: () => void;
  setActive: (a: ActiveWorkout | null) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<WorkoutCtx | null>(null);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [active, setActiveState] = useState<ActiveWorkout | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<RestTimer>({ duration: 90, remaining: 90, running: false, end_at: null });
  const [restRemaining, setRestRemaining] = useState(90);
  const tickRef = useRef<any>(null);
  const notifTickRef = useRef<any>(null);  // updates lock-screen notification ~every 60 s
  const lastNotifElapsed = useRef<number>(-1);
  // Always-current ref so cancelWorkout never uses a stale closure
  const activeRef = useRef<ActiveWorkout | null>(null);
  activeRef.current = active;

  // Persist active workout
  const setActive = useCallback((a: ActiveWorkout | null) => {
    setActiveState(a);
    if (a) {
      storage.setItem(ACTIVE_KEY, JSON.stringify(a) as any);
    } else {
      storage.removeItem(ACTIVE_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    // Local cache is the source of truth for in-progress exercise data — the
    // server only holds the workout shell (no sets) until the workout is finished.
    let localParsed: ActiveWorkout | null = null;
    try {
      const local = (await storage.getItem(ACTIVE_KEY, "")) as string;
      if (local && typeof local === "string") {
        localParsed = JSON.parse(local);
        if (localParsed) setActiveState(localParsed);
      }
    } catch {}
    // Then sync with server — but never let the empty server shell clobber the
    // locally-logged sets of the same workout.
    try {
      const r = await api<{ workout: any }>("/workouts/active");
      if (r.workout) {
        const serverW = r.workout;
        const serverExCount = (serverW.exercises || []).length;
        const localExCount = localParsed?.exercises?.length || 0;
        // Same workout still active AND local has at least as much data → keep local.
        if (localParsed && localParsed.workout_id === serverW.workout_id && localExCount >= serverExCount) {
          setActiveState(localParsed);
          storage.setItem(ACTIVE_KEY, JSON.stringify(localParsed) as any);
        } else {
          const w: ActiveWorkout = {
            workout_id: serverW.workout_id,
            name: serverW.name,
            notes: serverW.notes,
            exercises: serverW.exercises || [],
            started_at: serverW.started_at,
          };
          setActiveState(w);
          storage.setItem(ACTIVE_KEY, JSON.stringify(w) as any);
        }
      } else {
        // No active workout on the server — it was finished or cancelled elsewhere.
        setActiveState(null);
        storage.removeItem(ACTIVE_KEY);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Request notification permission once on startup
    ensureChannel();
    requestNotificationPermission();

    refresh();
    // Restore rest timer
    (async () => {
      try {
        const r = (await storage.getItem(REST_KEY, "")) as string;
        if (r) {
          const parsed: RestTimer = JSON.parse(r);
          if (parsed.running && parsed.end_at && parsed.end_at > Date.now()) {
            // still counting down
            setRest(parsed);
          } else {
            // expired or paused while closed — restore stopped, ready to start
            setRest({ duration: parsed.duration || 90, remaining: parsed.remaining || parsed.duration || 90, running: false, end_at: null });
          }
        }
      } catch {}
    })();
  }, [refresh]);

  // Tick timer
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      if (active?.started_at) {
        const startedMs = new Date(active.started_at).getTime();
        // Guard against a bad/future timestamp yielding a negative (stuck-at-0) timer.
        setElapsed(Math.max(0, Math.floor((Date.now() - startedMs) / 1000)));
      }
      if (rest.running && rest.end_at) {
        const remain = Math.max(0, Math.round((rest.end_at - Date.now()) / 1000));
        setRestRemaining(remain);
        if (remain === 0) {
          // Rest finished — stop and reset to the chosen duration, ready for the next set
          setRest((r) => ({ ...r, running: false, end_at: null, remaining: r.duration }));
          storage.removeItem(REST_KEY);
          if (active) {
            const el = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
            showWorkoutNotification({ workoutName: active.name, elapsedSeconds: el, exerciseCount: active.exercises.length });
          }
        }
      } else {
        setRestRemaining(rest.remaining);
      }
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [active, rest]);

  // Keep the lock-screen notification feeling "live": refresh the rest countdown
  // every few seconds while resting, and the elapsed workout time more frequently
  // than before. (A true second-by-second ticker needs iOS Live Activities — a
  // future native build; this is the lightweight in-between.)
  useEffect(() => {
    if (notifTickRef.current) clearInterval(notifTickRef.current);
    if (!active) {
      lastNotifElapsed.current = -1;
      return;
    }
    notifTickRef.current = setInterval(() => {
      if (!active?.started_at) return;
      const el = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
      if (rest.running && rest.end_at) {
        // Live-ish rest countdown on the lock screen.
        const remain = Math.max(0, Math.round((rest.end_at - Date.now()) / 1000));
        showRestNotification({ workoutName: active.name, elapsedSeconds: el, restRemaining: remain });
        return;
      }
      // Refresh elapsed time about every 15 s (was 60 s).
      if (el - lastNotifElapsed.current >= 15) {
        lastNotifElapsed.current = el;
        showWorkoutNotification({ workoutName: active.name, elapsedSeconds: el, exerciseCount: active.exercises.length });
      }
    }, 5000); // tick every 5 s
    return () => clearInterval(notifTickRef.current);
  }, [active, rest]);

  // Best-effort server backup of the in-progress workout so logged sets survive
  // an app kill or device switch. Debounced ~2.5s after the last change; the
  // local storage copy is still the primary source of truth.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncProgress = useCallback((a: ActiveWorkout | null) => {
    if (!a) return;
    api(`/workouts/${a.workout_id}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ name: a.name, exercises: a.exercises }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => syncProgress(activeRef.current), 2500);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [active, syncProgress]);

  // Flush immediately when the app is backgrounded (before JS is suspended).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") syncProgress(activeRef.current);
    });
    return () => sub.remove();
  }, [syncProgress]);

  const startWorkout = async (name?: string) => {
    const r = await api<{ workout: any }>("/workouts/start", {
      method: "POST",
      body: JSON.stringify({ name: name || "Workout", local_date: localDateStr() }),
    });
    const w: ActiveWorkout = {
      workout_id: r.workout.workout_id,
      name: r.workout.name,
      notes: r.workout.notes,
      exercises: [],
      started_at: r.workout.started_at,
    };
    setActive(w);
    // Show lock-screen notification immediately
    showWorkoutNotification({ workoutName: w.name, elapsedSeconds: 0, exerciseCount: 0 });
    lastNotifElapsed.current = 0;
    return w;
  };

  // Start a workout pre-filled from a routine — exercises are laid out with empty
  // sets so the user only logs weight & reps.
  const startWorkoutFromRoutine = async (routine: { name: string; exercises: any[] }) => {
    const r = await api<{ workout: any }>("/workouts/start", {
      method: "POST",
      body: JSON.stringify({ name: routine.name || "Workout", local_date: localDateStr() }),
    });
    const w: ActiveWorkout = {
      workout_id: r.workout.workout_id,
      name: r.workout.name,
      notes: r.workout.notes,
      exercises: (routine.exercises || []).map((ex: any) => {
        const uni = !!ex.is_unilateral;
        const count = Math.max(1, ex.target_sets || 1);
        const sets: SetData[] = Array.from({ length: count }, () =>
          uni
            ? { left_weight: 0, left_reps: 0, right_weight: 0, right_reps: 0, completed: false }
            : { weight: 0, reps: 0, completed: false },
        );
        return {
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          is_unilateral: uni,
          machine: ex.machine || null,
          notes: "",
          sets,
          rest_seconds: 90,
        };
      }),
      started_at: r.workout.started_at,
    };
    setActive(w);
    showWorkoutNotification({ workoutName: w.name, elapsedSeconds: 0, exerciseCount: w.exercises.length });
    lastNotifElapsed.current = 0;
    return w;
  };

  const finishWorkout = async (extras?: { caption?: string; photos?: string[]; visibility?: "public" | "private"; name?: string }) => {
    if (!active) return null;
    const durationSec = Math.max(0, Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000));
    const r = await api<any>(`/workouts/${active.workout_id}/finish`, {
      method: "POST",
      body: JSON.stringify({
        name: extras?.name || active.name,
        notes: active.notes,
        exercises: active.exercises,
        duration_seconds: durationSec,
        caption: extras?.caption || null,
        photos: extras?.photos || null,
        visibility: extras?.visibility || "public",
      }),
    });
    setActive(null);
    resetRest();
    clearWorkoutNotifications();
    return r;
  };

  const cancelWorkout = async () => {
    const workout = activeRef.current;
    if (!workout) return;
    // Clear all state immediately — use direct setters to avoid any closure issues
    setActiveState(null);
    activeRef.current = null;
    storage.removeItem(ACTIVE_KEY);
    setRest({ duration: 90, remaining: 90, running: false, end_at: null });
    setRestRemaining(90);
    storage.removeItem(REST_KEY);
    clearWorkoutNotifications().catch(() => {});
    cancelRestEndNotification().catch(() => {});
    // Fire delete in background — UI is already cleared regardless
    api(`/workouts/${workout.workout_id}`, { method: "DELETE" }).catch(() => {});
  };

  const update = (mutator: (w: ActiveWorkout) => ActiveWorkout) => {
    if (!active) return;
    const next = mutator({ ...active, exercises: active.exercises.map((e) => ({ ...e, sets: [...e.sets] })) });
    setActive(next);
  };

  const addExercise = (ex: { exercise_id: string; exercise_name: string; is_unilateral: boolean; machine?: string | null }) => {
    update((w) => ({
      ...w,
      exercises: [
        ...w.exercises,
        {
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          is_unilateral: ex.is_unilateral,
          machine: ex.machine || null,
          notes: "",
          sets: [{ weight: 0, reps: 0, completed: false }],
          rest_seconds: 90,
        },
      ],
    }));
  };

  const removeExercise = (i: number) => update((w) => ({ ...w, exercises: w.exercises.filter((_, idx) => idx !== i) }));

  const updateExercise = (i: number, updates: Partial<LoggedExercise>) =>
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, idx) => (idx === i ? { ...e, ...updates } : e)),
    }));

  const addSet = (i: number) =>
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, idx) => {
        if (idx !== i) return e;
        const last = e.sets[e.sets.length - 1];
        const newSet: SetData = e.is_unilateral
          ? {
              left_weight: last?.left_weight || 0,
              left_reps: last?.left_reps || 0,
              right_weight: last?.right_weight || 0,
              right_reps: last?.right_reps || 0,
              completed: false,
            }
          : { weight: last?.weight || 0, reps: last?.reps || 0, completed: false };
        return { ...e, sets: [...e.sets, newSet] };
      }),
    }));

  const removeSet = (i: number, si: number) =>
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, idx) =>
        idx === i ? { ...e, sets: e.sets.filter((_, sidx) => sidx !== si) } : e
      ),
    }));

  const updateSet = (i: number, si: number, updates: Partial<SetData>) =>
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, idx) => {
        if (idx !== i) return e;
        return {
          ...e,
          sets: e.sets.map((s, sidx) => {
            if (sidx !== si) return s;
            const merged = { ...s, ...updates } as SetData;
            // A set is "logged" (and counts) the moment reps are entered — works
            // for weighted and bodyweight sets. There's no manual complete step.
            const hasData = e.is_unilateral
              ? Number(merged.left_reps) > 0 || Number(merged.right_reps) > 0
              : Number(merged.reps) > 0;
            if (hasData && !merged.completed && updates.completed === undefined) {
              merged.completed = true;
            }
            return merged;
          }),
        };
      }),
    }));

  const completeSet = (i: number, si: number) => {
    if (!active) return;
    const ex = active.exercises[i];
    if (!ex) return;
    const set = ex.sets[si];
    const newCompleted = !set?.completed;
    updateSet(i, si, { completed: newCompleted });
    if (newCompleted) hapticLight();
  };

  // ---- Manual rest timer (top of the logging screen) ----
  const persistRest = (r: RestTimer) => storage.setItem(REST_KEY, JSON.stringify(r) as any);

  const setRestDuration = (seconds: number) => {
    const next: RestTimer = { duration: seconds, remaining: seconds, running: false, end_at: null };
    setRest(next);
    setRestRemaining(seconds);
    persistRest(next);
    cancelRestEndNotification();
  };

  const startRest = () => {
    setRest((r) => {
      const rem = r.remaining > 0 ? r.remaining : r.duration;
      const endAt = Date.now() + rem * 1000;
      const next: RestTimer = { ...r, remaining: rem, running: true, end_at: endAt };
      persistRest(next);
      if (active) {
        const el = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
        showRestNotification({ workoutName: active.name, elapsedSeconds: el, restRemaining: rem });
        scheduleRestEndNotification({ workoutName: active.name, restEndMs: endAt });
      }
      return next;
    });
  };

  const pauseRest = () => {
    setRest((r) => {
      if (!r.running) return r;
      const rem = r.end_at ? Math.max(0, Math.round((r.end_at - Date.now()) / 1000)) : r.remaining;
      const next: RestTimer = { ...r, running: false, end_at: null, remaining: rem };
      persistRest(next);
      return next;
    });
    cancelRestEndNotification();
    if (active) {
      const el = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
      showWorkoutNotification({ workoutName: active.name, elapsedSeconds: el, exerciseCount: active.exercises.length });
    }
  };

  const resetRest = () => {
    setRest((r) => {
      const next: RestTimer = { ...r, running: false, end_at: null, remaining: r.duration };
      setRestRemaining(r.duration);
      persistRest(next);
      return next;
    });
    cancelRestEndNotification();
    if (active) {
      const el = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
      showWorkoutNotification({ workoutName: active.name, elapsedSeconds: el, exerciseCount: active.exercises.length });
    }
  };

  return (
    <Ctx.Provider
      value={{
        active,
        elapsed,
        restRemaining,
        restDuration: rest?.duration || 0,
        startWorkout,
        startWorkoutFromRoutine,
        finishWorkout,
        cancelWorkout,
        addExercise,
        removeExercise,
        updateExercise,
        addSet,
        removeSet,
        updateSet,
        completeSet,
        restRunning: rest.running,
        setRestDuration,
        startRest,
        pauseRest,
        resetRest,
        setActive,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useWorkout = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWorkout must be inside WorkoutProvider");
  return c;
};
