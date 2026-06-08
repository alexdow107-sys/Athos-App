import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api/client";

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
  end_at: number;
  duration: number;
}

interface WorkoutCtx {
  active: ActiveWorkout | null;
  elapsed: number;
  restRemaining: number;
  restDuration: number;
  startWorkout: (name?: string) => Promise<ActiveWorkout>;
  finishWorkout: (extras?: { caption?: string; photos?: string[]; visibility?: "public" | "private"; name?: string }) => Promise<any>;
  cancelWorkout: () => Promise<void>;
  addExercise: (ex: { exercise_id: string; exercise_name: string; is_unilateral: boolean; machine?: string | null }) => void;
  removeExercise: (index: number) => void;
  updateExercise: (index: number, updates: Partial<LoggedExercise>) => void;
  addSet: (exIndex: number) => void;
  removeSet: (exIndex: number, setIndex: number) => void;
  updateSet: (exIndex: number, setIndex: number, updates: Partial<SetData>) => void;
  completeSet: (exIndex: number, setIndex: number) => void;
  startRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  setActive: (a: ActiveWorkout | null) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<WorkoutCtx | null>(null);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [active, setActiveState] = useState<ActiveWorkout | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<RestTimer | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);
  const tickRef = useRef<any>(null);

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
    // Try local cache first
    try {
      const local = (await storage.getItem(ACTIVE_KEY, "")) as string;
      if (local && typeof local === "string") {
        const parsed = JSON.parse(local);
        setActiveState(parsed);
      }
    } catch {}
    // Then sync with server
    try {
      const r = await api<{ workout: any }>("/workouts/active");
      if (r.workout) {
        const w: ActiveWorkout = {
          workout_id: r.workout.workout_id,
          name: r.workout.name,
          notes: r.workout.notes,
          exercises: r.workout.exercises || [],
          started_at: r.workout.started_at,
        };
        setActiveState(w);
        storage.setItem(ACTIVE_KEY, JSON.stringify(w) as any);
      } else {
        setActiveState(null);
        storage.removeItem(ACTIVE_KEY);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    // Restore rest timer
    (async () => {
      try {
        const r = (await storage.getItem(REST_KEY, "")) as string;
        if (r) {
          const parsed: RestTimer = JSON.parse(r);
          if (parsed.end_at > Date.now()) {
            setRest(parsed);
          } else {
            storage.removeItem(REST_KEY);
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
        setElapsed(Math.floor((Date.now() - startedMs) / 1000));
      }
      if (rest) {
        const remain = Math.max(0, Math.floor((rest.end_at - Date.now()) / 1000));
        setRestRemaining(remain);
        if (remain === 0) {
          setRest(null);
          storage.removeItem(REST_KEY);
        }
      } else {
        setRestRemaining(0);
      }
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [active, rest]);

  const startWorkout = async (name?: string) => {
    const r = await api<{ workout: any }>("/workouts/start", {
      method: "POST",
      body: JSON.stringify({ name: name || "Workout" }),
    });
    const w: ActiveWorkout = {
      workout_id: r.workout.workout_id,
      name: r.workout.name,
      notes: r.workout.notes,
      exercises: [],
      started_at: r.workout.started_at,
    };
    setActive(w);
    return w;
  };

  const finishWorkout = async (extras?: { caption?: string; photos?: string[]; visibility?: "public" | "private"; name?: string }) => {
    if (!active) return null;
    const durationSec = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
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
    stopRestTimer();
    return r;
  };

  const cancelWorkout = async () => {
    if (!active) return;
    try {
      await api(`/workouts/${active.workout_id}`, { method: "DELETE" });
    } catch {}
    setActive(null);
    stopRestTimer();
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
            // Auto-mark complete when weight & reps are present (no need for manual check)
            const hasData = e.is_unilateral
              ? (Number(merged.left_weight) > 0 && Number(merged.left_reps) > 0) ||
                (Number(merged.right_weight) > 0 && Number(merged.right_reps) > 0)
              : Number(merged.weight) > 0 && Number(merged.reps) > 0;
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
    if (newCompleted) {
      startRestTimer(ex.rest_seconds || 90);
    }
  };

  const startRestTimer = (seconds: number) => {
    const r: RestTimer = { end_at: Date.now() + seconds * 1000, duration: seconds };
    setRest(r);
    storage.setItem(REST_KEY, JSON.stringify(r) as any);
  };

  const stopRestTimer = () => {
    setRest(null);
    storage.removeItem(REST_KEY);
  };

  return (
    <Ctx.Provider
      value={{
        active,
        elapsed,
        restRemaining,
        restDuration: rest?.duration || 0,
        startWorkout,
        finishWorkout,
        cancelWorkout,
        addExercise,
        removeExercise,
        updateExercise,
        addSet,
        removeSet,
        updateSet,
        completeSet,
        startRestTimer,
        stopRestTimer,
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
