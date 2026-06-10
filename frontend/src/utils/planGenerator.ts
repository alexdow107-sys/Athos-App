// Rule-based workout plan generator.

export type Goal = "strength" | "hypertrophy" | "weight_loss" | "endurance" | "athletic" | "general";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Equipment = "full_gym" | "home_dumbbells" | "bodyweight";
export type Gender = "male" | "female" | "unspecified";

export interface PlanExercise {
  name: string;
  sets: number;
  reps: string;
  note?: string;
}

export interface PlanDay {
  day: string;
  focus: string;
  isRest: boolean;
  exercises: PlanExercise[];
}

export interface GeneratedPlan {
  splitName: string;
  splitNotice?: string;
  days: PlanDay[];
  coachNote: string;
}

// ── Exercise library ──────────────────────────────────────────────────────────
// Each list is ordered: compounds first, isolations last.
// Two exercises are picked when sets > 3; three when sets > 6.
// Variant (0/1/2…) offsets into the list for A/B variation.

const EX: Record<string, Record<Equipment, string[]>> = {
  chest: {
    full_gym:       ["Barbell Bench Press", "Incline Barbell Press", "Incline Dumbbell Press", "Cable Fly", "Chest Dips", "Decline Bench Press", "Pec Deck"],
    home_dumbbells: ["Dumbbell Bench Press", "Incline Dumbbell Press", "Dumbbell Fly", "Push-Ups"],
    bodyweight:     ["Push-Ups", "Wide Push-Ups", "Decline Push-Ups", "Diamond Push-Ups"],
  },
  back: {
    full_gym:       ["Barbell Row", "Lat Pulldown", "Seated Cable Row", "Pull-Ups", "T-Bar Row", "Single-Arm DB Row", "Chest-Supported Row"],
    home_dumbbells: ["Dumbbell Row", "Pull-Ups", "Renegade Row", "Dumbbell Pullover"],
    bodyweight:     ["Pull-Ups", "Inverted Row", "Bodyweight Row", "Superman Hold"],
  },
  rear_delts: {
    full_gym:       ["Face Pulls", "Rear Delt Fly", "Reverse Pec Deck", "Band Pull-Apart"],
    home_dumbbells: ["Rear Delt Fly", "Bent-Over Lateral Raise", "Band Pull-Apart"],
    bodyweight:     ["Band Pull-Apart", "Prone Y-Raise", "Reverse Snow Angels"],
  },
  shoulders: {
    full_gym:       ["Overhead Press", "Dumbbell Shoulder Press", "Lateral Raises", "Arnold Press", "Upright Row", "Front Raises"],
    home_dumbbells: ["Dumbbell Shoulder Press", "Lateral Raises", "Arnold Press", "Front Raises"],
    bodyweight:     ["Pike Push-Ups", "Handstand Hold (Wall)", "Band Lateral Raise"],
  },
  biceps: {
    full_gym:       ["Barbell Curl", "Incline Dumbbell Curl", "Cable Curl", "Hammer Curl", "Preacher Curl"],
    home_dumbbells: ["Dumbbell Curl", "Hammer Curl", "Incline Curl", "Concentration Curl"],
    bodyweight:     ["Chin-Ups", "Resistance Band Curl", "Towel Curl"],
  },
  triceps: {
    full_gym:       ["Tricep Pushdown", "Skull Crushers", "Overhead Tricep Extension", "Close-Grip Bench Press", "Tricep Dips"],
    home_dumbbells: ["Overhead Dumbbell Extension", "Dumbbell Skull Crusher", "Tricep Kickback", "Close-Grip Push-Ups"],
    bodyweight:     ["Tricep Dips", "Diamond Push-Ups", "Close-Grip Push-Ups", "Bench Dips"],
  },
  quads: {
    full_gym:       ["Barbell Squat", "Leg Press", "Hack Squat", "Bulgarian Split Squat", "Leg Extension", "Front Squat"],
    home_dumbbells: ["Goblet Squat", "Bulgarian Split Squat", "Dumbbell Lunge", "Step-Ups"],
    bodyweight:     ["Bodyweight Squat", "Jump Squat", "Lunge", "Bulgarian Split Squat", "Wall Sit"],
  },
  hamstrings: {
    full_gym:       ["Romanian Deadlift", "Lying Leg Curl", "Seated Leg Curl", "Stiff-Leg Deadlift", "Nordic Curl", "Good Mornings"],
    home_dumbbells: ["Romanian Deadlift", "Single-Leg RDL", "Dumbbell Leg Curl", "Nordic Curl"],
    bodyweight:     ["Nordic Curl", "Single-Leg Glute Bridge", "Good Mornings", "Glute-Ham Raise"],
  },
  glutes: {
    full_gym:       ["Barbell Hip Thrust", "Cable Kickback", "Hip Abduction Machine", "Romanian Deadlift", "Sumo Deadlift", "Leg Press (High Foot)", "Reverse Hyper"],
    home_dumbbells: ["Dumbbell Hip Thrust", "Donkey Kickback", "Side-Lying Hip Abduction", "Romanian Deadlift", "Sumo Squat"],
    bodyweight:     ["Hip Thrust", "Single-Leg Glute Bridge", "Donkey Kick", "Fire Hydrant", "Clamshell", "Frog Pump"],
  },
  hip_adduction: {
    full_gym:       ["Machine Hip Adduction", "Cable Hip Adduction", "Copenhagen Plank", "Sumo Squat"],
    home_dumbbells: ["Sumo Squat", "Lateral Lunge", "Resistance Band Adduction"],
    bodyweight:     ["Lateral Lunge", "Sumo Squat", "Side-Lying Hip Adduction", "Copenhagen Plank"],
  },
  forearms: {
    full_gym:       ["Barbell Wrist Curl", "Reverse Wrist Curl", "Barbell Reverse Curl", "Farmer's Carry"],
    home_dumbbells: ["Dumbbell Wrist Curl", "Reverse Wrist Curl", "Hammer Curl", "Farmer's Carry"],
    bodyweight:     ["Dead Hang", "Towel Pull-Up", "Wrist Roller"],
  },
  abs: {
    full_gym:       ["Cable Crunch", "Hanging Leg Raise", "Ab Wheel Rollout", "Decline Sit-Up", "Plank", "Russian Twist"],
    home_dumbbells: ["Ab Wheel Rollout", "Dead Bug", "Hollow Body Hold", "Weighted Sit-Ups", "Plank"],
    bodyweight:     ["Plank", "Hollow Body Hold", "Dead Bug", "Bicycle Crunch", "Leg Raise", "Hanging Knee Raise"],
  },
};

// ── Rep & rest rules by goal ───────────────────────────────────────────────────

function getReps(goal: Goal): string {
  switch (goal) {
    case "strength":    return "3–5";
    case "hypertrophy": return "8–12";
    case "weight_loss": return "12–15";
    case "endurance":   return "15–20";
    case "athletic":    return "5–8";
    default:            return "10–12";
  }
}

function getRestNote(goal: Goal): string {
  switch (goal) {
    case "strength":    return "Rest 3–4 min";
    case "hypertrophy": return "Rest 60–90 s";
    case "weight_loss": return "Rest 30–45 s";
    case "endurance":   return "Rest 30 s";
    case "athletic":    return "Rest 2–3 min";
    default:            return "Rest 60 s";
  }
}

// ── Injury / preference parser ─────────────────────────────────────────────────

interface Mods {
  noOverhead: boolean;
  noSquats: boolean;
  noDeadlifts: boolean;
  moreGlutes: boolean;
  moreLegs: boolean;
  moreArms: boolean;
  moreChest: boolean;
  moreBack: boolean;
}

function parseMods(injuries = "", notes = ""): Mods {
  const t = (injuries + " " + notes).toLowerCase();
  return {
    noOverhead:  /shoulder (pain|injury)|rotator|no overhead|impingement/.test(t),
    noSquats:    /\bknee\b|bad knee|no squat|knee pain/.test(t),
    noDeadlifts: /lower back|back pain|herniated|slipped disc|no deadlift/.test(t),
    moreGlutes:  /glute|booty|butt|hip thrust|posterior|bum/.test(t),
    moreLegs:    /more leg|leg day|lower body|quads|hamstring/.test(t),
    moreArms:    /\barm|bicep|tricep|sleeve/.test(t),
    moreChest:   /chest|pec/.test(t),
    moreBack:    /\bback\b|lat|more back/.test(t),
  };
}

// ── Exercise picker ────────────────────────────────────────────────────────────

function getList(muscle: string, equipment: Equipment, mods: Mods): string[] {
  const base: string[] = EX[muscle]?.[equipment] ?? EX[muscle]?.full_gym ?? [];
  if (mods.noOverhead && muscle === "shoulders")
    return base.filter(e => !/(overhead press|arnold|upright row)/i.test(e));
  if (mods.noSquats && muscle === "quads")
    return base.filter(e => !/barbell squat|front squat/i.test(e));
  if (mods.noDeadlifts && (muscle === "hamstrings" || muscle === "glutes"))
    return base.filter(e => !/deadlift|rdl|stiff-leg/i.test(e));
  return base;
}

function pickEx(
  muscle: string,
  equipment: Equipment,
  totalSets: number,
  reps: string,
  restNote: string,
  variant: number,
  mods: Mods,
): PlanExercise[] {
  const list = getList(muscle, equipment, mods);
  if (!list.length || totalSets <= 0) return [];

  const offset = (variant * 2) % list.length;
  const get = (i: number) => list[i % list.length];

  if (totalSets <= 3 || list.length === 1) {
    return [{ name: get(offset), sets: totalSets, reps, note: restNote }];
  }
  if (totalSets <= 6) {
    const s1 = Math.ceil(totalSets / 2);
    return [
      { name: get(offset),     sets: s1,            reps, note: restNote },
      { name: get(offset + 1), sets: totalSets - s1, reps, note: restNote },
    ];
  }
  // 7+ sets: three exercises
  const rem = totalSets - 3;
  return [
    { name: get(offset),     sets: 3,                  reps, note: restNote },
    { name: get(offset + 1), sets: Math.ceil(rem / 2),  reps, note: restNote },
    { name: get(offset + 2), sets: Math.floor(rem / 2), reps, note: restNote },
  ];
}

// ── Session builders ───────────────────────────────────────────────────────────
// Volume rules:
//  PUSH (PPL)  : chest 4–5, shoulders 3–4, triceps 2–3, rear_delts 2       → ~12–14 sets
//  PULL (PPL)  : back 5, rear_delts 2, biceps 2–3                          → 9–10 sets
//  LEGS (PPL)  : quads 4 (F:3), hams 3, glutes 2–4, hip_add 1–2, forearms 2, abs 3 → 15–18
//  UPPER (UL)  : chest 3–4, back 4, shoulders 2–3, biceps 2, triceps 2–3   → 14–16
//  LOWER (UL)  : quads 4, hams 3, glutes 2–4, hip_add 1–2, forearms 2, abs 3     → 15–17
//  FULL BODY   : 2–3 sets per main muscle group                             → 15–18
//  FULL 1×     : 2–3 sets every muscle group                                → 18–22
//  UPPER 7×    : reduced: chest 2, back 2, shoulders 2, biceps 1–2, triceps 1–2   → 8–10
//  LOWER 7×    : reduced: quads 3, hams 2, glutes 2–3, forearms 1, abs 2          → 10–11
//
// Arm priority alternates: push A = triceps 3; push B = triceps 2 (biceps priority shifts on pull).
// Females / moreGlutes flag: +1–2 sets glutes, hip-thrust–first exercise order.

type SessionType = "push" | "pull" | "legs" | "upper" | "lower" | "full" | "full_1x" | "upper_7x" | "lower_7x";

function buildSession(
  type: SessionType,
  equipment: Equipment,
  goal: Goal,
  gender: Gender,
  mods: Mods,
  variant: number,
): PlanExercise[] {
  const reps = getReps(goal);
  const rest = getRestNote(goal);
  const female = gender === "female";
  const extraGlutes = female || mods.moreGlutes;
  const v = variant;
  const out: PlanExercise[] = [];

  const add = (m: string, sets: number) => {
    if (sets <= 0) return;
    out.push(...pickEx(m, equipment, sets, reps, rest, v, mods));
  };

  switch (type) {
    case "push": {
      // Alternate tricep/shoulder priority
      const chestSets    = v === 0 ? 5 : 4;
      const shoulderSets = v === 0 ? 3 : 4;
      const tricepSets   = v === 0 ? 3 : 2;  // v0 = triceps priority
      add("chest",      chestSets    + (mods.moreChest ? 1 : 0));
      add("shoulders",  shoulderSets + (mods.noOverhead ? 1 : 0)); // swap OHP sets to laterals
      add("triceps",    tricepSets   + (mods.moreArms ? 1 : 0));
      add("rear_delts", 2);
      break;
    }
    case "pull": {
      // Alternate bicep priority
      const bicepSets = v === 0 ? 3 : 2;  // v0 = biceps priority
      add("back",       5 + (mods.moreBack ? 1 : 0));
      add("rear_delts", 2);
      add("biceps",     bicepSets + (mods.moreArms ? 1 : 0));
      break;
    }
    case "legs": {
      // Women: more glute volume, slightly less quad
      const quadSets  = female ? 3 : 4 + (mods.moreLegs ? 1 : 0);
      const gluteSets = extraGlutes ? (v === 0 ? 4 : 3) : (v === 0 ? 2 : 3);
      const hipAdd    = v === 0 ? 2 : 1;
      add("quads",        quadSets);
      add("hamstrings",   3);
      add("glutes",       gluteSets);
      add("hip_adduction", hipAdd);
      add("forearms",     2);
      add("abs",          v === 0 ? 3 : 2);
      break;
    }
    case "upper": {
      // Alternate arm priority: v0 → biceps focus, v1 → triceps focus
      const chestSets  = v === 0 ? 4 : 3;
      const shouldSets = v === 0 ? 3 : 2;
      const bicepSets  = v === 0 ? 2 : 2;
      const tricepSets = v === 0 ? 2 : 3;
      add("chest",     chestSets  + (mods.moreChest ? 1 : 0));
      add("back",      4          + (mods.moreBack ? 1 : 0));
      add("shoulders", shouldSets);
      add("biceps",    bicepSets  + (mods.moreArms ? 1 : 0));
      add("triceps",   tricepSets + (mods.moreArms ? 1 : 0));
      break;
    }
    case "lower": {
      const gluteSets = extraGlutes ? (v === 0 ? 3 : 4) : 2;
      const hipAdd    = v === 0 ? 2 : 1;
      add("quads",        4 + (mods.moreLegs ? 1 : 0));
      add("hamstrings",   3);
      add("glutes",       gluteSets);
      add("hip_adduction", hipAdd);
      add("forearms",     2);
      add("abs",          v === 0 ? 3 : 2);
      break;
    }
    case "full": {
      // Full body for 2x / 3x — 2–3 sets each
      // Rotate which muscle gets extra emphasis each variant
      const gluteSets  = extraGlutes ? 3 : 2;
      const bicepSets  = v === 0 ? 2 : 1;
      const tricepSets = v === 0 ? 1 : 2;
      const quadSets   = v === 0 ? 3 : 2;
      const shouldSets = v === 1 ? 2 : 1;
      add("quads",      quadSets);
      add("hamstrings", 2);
      add("glutes",     gluteSets);
      add("chest",      2);
      add("back",       2);
      add("shoulders",  shouldSets);
      add("biceps",     bicepSets);
      add("triceps",    tricepSets);
      add("abs",        2);
      break;
    }
    case "full_1x": {
      // 1× per week — 2–3 sets each for every muscle group (including smaller ones)
      const gluteSets = extraGlutes ? 3 : 2;
      add("quads",        3);
      add("hamstrings",   2);
      add("glutes",       gluteSets);
      add("hip_adduction", 1);
      add("chest",        2);
      add("back",         2);
      add("shoulders",    2);
      add("biceps",       2);
      add("triceps",      2);
      add("forearms",     1);
      add("abs",          2);
      break;
    }
    case "upper_7x": {
      // Reduced volume to survive daily training
      const tricepSets = v % 2 === 0 ? 1 : 2;
      const bicepSets  = v % 2 === 0 ? 2 : 1;
      add("chest",     2);
      add("back",      2);
      add("shoulders", 2);
      add("biceps",    bicepSets);
      add("triceps",   tricepSets);
      break;
    }
    case "lower_7x": {
      const gluteSets = extraGlutes ? 3 : 2;
      add("quads",      3);
      add("hamstrings", 2);
      add("glutes",     gluteSets);
      add("forearms",   1);
      add("abs",        2);
      break;
    }
  }

  return out;
}

// ── Weekly schedules ───────────────────────────────────────────────────────────

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DayDef = { focus: string; type: SessionType | "rest"; variant: number };

function getSchedule(daysPerWeek: number): { splitName: string; splitNotice?: string; days: DayDef[] } {
  const rest = (focus = "Rest & Recovery"): DayDef => ({ focus, type: "rest", variant: 0 });

  switch (daysPerWeek) {
    case 1:
      return {
        splitName: "Full Body (once a week)",
        splitNotice: "Not recommended — once a week is the bare minimum. Progress will be slow. Consider 3×/week for meaningful gains.",
        days: [
          { focus: "Full Body", type: "full_1x", variant: 0 },
          rest(), rest(), rest(), rest(), rest(), rest(),
        ],
      };
    case 2:
      return {
        splitName: "Full Body × 2",
        days: [
          { focus: "Full Body A", type: "full", variant: 0 }, rest(), rest(),
          { focus: "Full Body B", type: "full", variant: 1 }, rest(), rest(), rest(),
        ],
      };
    case 3:
      return {
        splitName: "Full Body × 3",
        days: [
          { focus: "Full Body A", type: "full", variant: 0 }, rest(),
          { focus: "Full Body B", type: "full", variant: 1 }, rest(),
          { focus: "Full Body C", type: "full", variant: 2 }, rest(), rest(),
        ],
      };
    case 4:
      return {
        splitName: "Upper / Lower × 2",
        days: [
          { focus: "Upper A", type: "upper", variant: 0 },
          { focus: "Lower A", type: "lower", variant: 0 },
          rest(),
          { focus: "Upper B", type: "upper", variant: 1 },
          { focus: "Lower B", type: "lower", variant: 1 },
          rest(), rest(),
        ],
      };
    case 5:
      return {
        splitName: "Push / Pull / Legs + Upper / Lower",
        days: [
          { focus: "Push",  type: "push",  variant: 0 },
          { focus: "Pull",  type: "pull",  variant: 0 },
          { focus: "Legs",  type: "legs",  variant: 0 },
          rest(),
          { focus: "Upper", type: "upper", variant: 1 },
          { focus: "Lower", type: "lower", variant: 1 },
          rest(),
        ],
      };
    case 6:
      return {
        splitName: "Push / Pull / Legs × 2",
        days: [
          { focus: "Push A", type: "push", variant: 0 },
          { focus: "Pull A", type: "pull", variant: 0 },
          { focus: "Legs A", type: "legs", variant: 0 },
          { focus: "Push B", type: "push", variant: 1 },
          { focus: "Pull B", type: "pull", variant: 1 },
          { focus: "Legs B", type: "legs", variant: 1 },
          rest(),
        ],
      };
    case 7:
      return {
        splitName: "Upper / Lower (7 days)",
        splitNotice: "Not recommended — training every day with no rest severely limits recovery. Only appropriate for advanced athletes in a structured programme.",
        days: [
          { focus: "Upper A", type: "upper_7x", variant: 0 },
          { focus: "Lower A", type: "lower_7x", variant: 0 },
          { focus: "Upper B", type: "upper_7x", variant: 1 },
          { focus: "Lower B", type: "lower_7x", variant: 1 },
          { focus: "Upper C", type: "upper_7x", variant: 2 },
          { focus: "Lower C", type: "lower_7x", variant: 2 },
          { focus: "Upper D", type: "upper_7x", variant: 3 },
        ],
      };
    default:
      return getSchedule(3);
  }
}

// ── Coach note ─────────────────────────────────────────────────────────────────

function buildCoachNote(goal: Goal, experience: Experience, days: number, equipment: Equipment, gender: Gender): string {
  const eqLabel = equipment === "full_gym" ? "a full gym" : equipment === "home_dumbbells" ? "a home gym" : "bodyweight only";
  const expNote = experience === "beginner"
    ? "Nail your form before loading up — technique compounds over time just like weight does."
    : experience === "intermediate"
    ? "Aim for progressive overload every session — add a rep or a small amount of weight each week."
    : "Track every lift. Deload every 4–6 weeks, prioritise sleep, and push for intentional PRs.";
  const goalNote = goal === "strength"
    ? "Keep the big compounds heavy and rest periods long."
    : goal === "hypertrophy"
    ? "Chase the pump — full range of motion and a strong mind-muscle connection on every rep."
    : goal === "weight_loss"
    ? "Keep rest periods short. Consider 10–15 min steady-state cardio after lifting."
    : goal === "endurance"
    ? "Keep intensity moderate, rest minimal, and volume high."
    : goal === "athletic"
    ? "Be explosive on the concentric — power output matters more than the load."
    : "Stay consistent. Small wins every session add up fast.";
  const genderNote = gender === "female"
    ? " Glute volume is prioritised — hip thrusts and kickbacks are your best friends."
    : "";
  const daysNote = days === 1
    ? " You're training once a week — this is the minimum effective dose. Try to add a second session when you can."
    : days === 7
    ? " You have no full rest days — watch for excessive soreness or joint fatigue and pull back if needed."
    : "";
  return `${days}×/week · ${eqLabel}. ${expNote} ${goalNote}${genderNote}${daysNote}`;
}

// ── Main export ────────────────────────────────────────────────────────────────

export function generatePlan(prefs: {
  days_per_week?: number;
  primary_goal?: string;
  experience_level?: string;
  equipment?: string;
  gender?: string;
  injuries?: string;
  extra_notes?: string;
  focus_areas?: string[];
}): GeneratedPlan {
  const days       = Math.min(7, Math.max(1, prefs.days_per_week ?? 3));
  const goal       = (prefs.primary_goal    ?? "general")      as Goal;
  const experience = (prefs.experience_level ?? "intermediate") as Experience;
  const equipment  = (prefs.equipment        ?? "full_gym")     as Equipment;
  const gender     = (prefs.gender           ?? "unspecified")  as Gender;

  const mods = parseMods(prefs.injuries, prefs.extra_notes);

  // Focus areas override mods
  const focus = (prefs.focus_areas ?? []).map(f => f.toLowerCase());
  if (focus.some(f => ["glutes"].includes(f)))                           mods.moreGlutes = true;
  if (focus.some(f => ["hamstrings", "quads"].includes(f)))              mods.moreLegs   = true;
  if (focus.some(f => ["biceps", "triceps", "arms"].includes(f)))        mods.moreArms   = true;
  if (focus.some(f => ["chest"].includes(f)))                            mods.moreChest  = true;
  if (focus.some(f => ["back"].includes(f)))                             mods.moreBack   = true;

  const { splitName, splitNotice, days: schedule } = getSchedule(days);

  const planDays: PlanDay[] = schedule.map((d, i) => {
    if (d.type === "rest") {
      return { day: WEEK[i], focus: d.focus, isRest: true, exercises: [] };
    }
    const exercises = buildSession(d.type as SessionType, equipment, goal, gender, mods, d.variant);
    return { day: WEEK[i], focus: d.focus, isRest: false, exercises };
  });

  return {
    splitName,
    splitNotice,
    days: planDays,
    coachNote: buildCoachNote(goal, experience, days, equipment, gender),
  };
}
