import type {
  Exercise,
  ExerciseType,
  Muscle,
  Split,
  User,
  WorkoutSession,
} from "@/types";

export interface MockUser extends User {
  password: string;
  qr_code_url: string | null;
  profile_picture_url: string | null;
}

export interface MockDB {
  users: MockUser[];
  muscles: Muscle[];
  exercises: Exercise[];
  favorites: { user_id: string; exercise_id: string }[];
  splits: (Split & { user_id: string })[];
  workoutSessions: (WorkoutSession & { user_id: string })[];
  nextId: {
    user: number;
    split: number;
    workoutSession: number;
    workoutExercise: number;
    set: number;
    supersetGroup: number;
  };
}

/**
 * The full muscle catalog — filenames under public/muscles match these slugs
 * exactly (e.g. `full_body.png`), so no per-muscle override map is needed.
 * `name` is stored raw/lowercase to mirror what the real API sends (see
 * primary_muscle on a live exercise, e.g. "abdominals") — display code
 * capitalizes it (formatMuscleName in lib/format.ts), it isn't pre-formatted
 * here.
 */
const MUSCLE_SLUGS = [
  "forearms",
  "calves",
  "hamstrings",
  "biceps",
  "glutes",
  "traps",
  "shoulders",
  "abductors",
  "cardio",
  "full_body",
  "adductors",
  "quadriceps",
  "upper_back",
  "triceps",
  "lower_back",
  "other",
  "abdominals",
  "neck",
  "chest",
  "lats",
] as const;

const MUSCLES: Muscle[] = MUSCLE_SLUGS.map((slug, i) => ({
  id: String(i + 1),
  name: slug,
  pic: `/muscles/${slug}.png`,
}));

const MUSCLE_ID_BY_SLUG = new Map(MUSCLES.map((m) => [m.name, m.id]));
const MUSCLE_BY_ID = new Map(MUSCLES.map((m) => [m.id, m]));

function muscleId(slug: (typeof MUSCLE_SLUGS)[number]): string {
  return MUSCLE_ID_BY_SLUG.get(slug)!;
}

const EXERCISE_NAMES: {
  id: number;
  name: string;
  muscle: (typeof MUSCLE_SLUGS)[number];
}[] = [
  // Chest
  { id: 10, name: "Barbell Bench Press", muscle: "chest" },
  { id: 11, name: "Incline Dumbbell Press", muscle: "chest" },
  { id: 12, name: "Cable Fly", muscle: "chest" },
  { id: 13, name: "Push-Up", muscle: "chest" },
  { id: 14, name: "Dumbbell Fly", muscle: "chest" },
  { id: 15, name: "Smith Machine Bench Press", muscle: "chest" },
  { id: 16, name: "Lever Chest Press", muscle: "chest" },
  { id: 17, name: "Pec Deck Fly", muscle: "chest" },
  // Back (split across the real catalog's more granular back muscles)
  { id: 20, name: "Deadlift", muscle: "lower_back" },
  { id: 21, name: "Pull-Up", muscle: "lats" },
  { id: 22, name: "Barbell Row", muscle: "lats" },
  { id: 23, name: "Lat Pulldown", muscle: "lats" },
  { id: 24, name: "Seated Cable Row", muscle: "upper_back" },
  { id: 25, name: "T-Bar Row", muscle: "upper_back" },
  { id: 26, name: "Barbell Shrug", muscle: "traps" },
  { id: 27, name: "Straight-Arm Pulldown", muscle: "lats" },
  // Shoulders
  { id: 30, name: "Overhead Press", muscle: "shoulders" },
  { id: 31, name: "Lateral Raise", muscle: "shoulders" },
  { id: 32, name: "Rear Delt Fly", muscle: "shoulders" },
  { id: 33, name: "Arnold Press", muscle: "shoulders" },
  { id: 34, name: "Front Raise", muscle: "shoulders" },
  { id: 35, name: "Upright Row", muscle: "shoulders" },
  { id: 36, name: "Band Face Pull", muscle: "shoulders" },
  // Quads
  { id: 40, name: "Back Squat", muscle: "quadriceps" },
  { id: 41, name: "Leg Press", muscle: "quadriceps" },
  { id: 42, name: "Walking Lunge", muscle: "quadriceps" },
  { id: 43, name: "Leg Extension", muscle: "quadriceps" },
  { id: 44, name: "Smith Machine Squat", muscle: "quadriceps" },
  { id: 45, name: "Goblet Squat", muscle: "quadriceps" },
  { id: 46, name: "Bulgarian Split Squat", muscle: "quadriceps" },
  // Hamstrings
  { id: 50, name: "Romanian Deadlift", muscle: "hamstrings" },
  { id: 51, name: "Lying Leg Curl", muscle: "hamstrings" },
  { id: 52, name: "Seated Leg Curl", muscle: "hamstrings" },
  { id: 53, name: "Glute Ham Raise", muscle: "hamstrings" },
  // Biceps
  { id: 60, name: "Barbell Curl", muscle: "biceps" },
  { id: 61, name: "Hammer Curl", muscle: "biceps" },
  { id: 62, name: "Concentration Curl", muscle: "biceps" },
  { id: 63, name: "Preacher Curl", muscle: "biceps" },
  { id: 64, name: "Cable Curl", muscle: "biceps" },
  { id: 65, name: "EZ-Bar Curl", muscle: "biceps" },
  // Triceps
  { id: 70, name: "Triceps Pushdown", muscle: "triceps" },
  { id: 71, name: "Skull Crusher", muscle: "triceps" },
  { id: 72, name: "Diamond Push-Up", muscle: "triceps" },
  { id: 73, name: "Overhead Triceps Extension", muscle: "triceps" },
  { id: 74, name: "Close-Grip Bench Press", muscle: "triceps" },
  { id: 75, name: "Seated Dip", muscle: "triceps" },
  // Core
  { id: 80, name: "Hanging Leg Raise", muscle: "abdominals" },
  { id: 81, name: "Cable Crunch", muscle: "abdominals" },
  { id: 82, name: "Plank", muscle: "abdominals" },
  { id: 83, name: "Lying Leg Raise", muscle: "abdominals" },
  { id: 84, name: "Russian Twist", muscle: "abdominals" },
  { id: 85, name: "L-Sit", muscle: "abdominals" },
  // Calves
  { id: 90, name: "Standing Calf Raise", muscle: "calves" },
  { id: 91, name: "Lever Standing Calf Raise", muscle: "calves" },
  { id: 92, name: "Smith Machine Calf Raise", muscle: "calves" },
  // Forearms
  { id: 100, name: "Barbell Reverse Wrist Curl", muscle: "forearms" },
  { id: 101, name: "Cable Hammer Curl", muscle: "forearms" },
  { id: 102, name: "Barbell Reverse Curl", muscle: "forearms" },
  // Glutes
  { id: 110, name: "Barbell Hip Thrust", muscle: "glutes" },
  { id: 111, name: "Lever Hip Thrust", muscle: "glutes" },
  { id: 112, name: "Hyperextension", muscle: "glutes" },
];

/** Movements with no external load — everything else defaults to "weighted". */
const BODY_WEIGHT_EXERCISE_IDS = new Set([13, 21, 72, 80, 82, 83, 85]);

/**
 * Secondary muscles worked by each exercise. Not exhaustive — a
 * representative subset of the catalog, same ~40% split the real dataset
 * has (65/149 exercises carry at least one).
 */
const SECONDARY_MUSCLES: Record<number, (typeof MUSCLE_SLUGS)[number][]> = {
  10: ["shoulders", "triceps"], // Bench Press
  11: ["shoulders", "triceps"],
  15: ["shoulders", "triceps"],
  16: ["shoulders", "triceps"],
  17: ["shoulders"],
  20: ["hamstrings", "glutes"], // Deadlift
  21: ["biceps"], // Pull-Up
  22: ["biceps"],
  23: ["biceps"],
  24: ["biceps"],
  40: ["glutes", "hamstrings"], // Back Squat
  41: ["glutes"],
  42: ["glutes"],
  44: ["glutes"],
  45: ["glutes"],
  46: ["glutes"],
  50: ["glutes"], // Romanian Deadlift
  60: ["forearms"], // Barbell Curl
  63: ["forearms"],
  65: ["forearms"],
  74: ["chest"], // Close-Grip Bench Press
  75: ["chest", "triceps"], // Seated Dip
  110: ["hamstrings"], // Hip Thrust
  111: ["hamstrings"],
  112: ["hamstrings"],
};

const EXERCISES: Exercise[] = EXERCISE_NAMES.map((e) => ({
  id: String(e.id),
  name: e.name,
  muscle_id: muscleId(e.muscle),
  exercise_type: (BODY_WEIGHT_EXERCISE_IDS.has(e.id)
    ? "body_weight"
    : "weighted") as ExerciseType,
  thumbnail_url: null,
  video_url: null,
  rest_time: 90,
  tips: null,
  equipment: null,
  favourite: false,
  primary_muscle: e.muscle,
  secondary_muscles: (SECONDARY_MUSCLES[e.id] ?? [])
    .map((slug) => MUSCLE_BY_ID.get(muscleId(slug)))
    .filter((m): m is Muscle => m !== undefined),
}));

const DEMO_USER_ID = "1";

function iso(daysAgo: number, hour = 18, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildHistorySession(
  id: number,
  daysAgo: number,
  splitId: number | null,
  plan: {
    exerciseId: number;
    supersetWith?: number;
    sets: {
      type: "warmup" | "standard" | "drop" | "myorep";
      w: number;
      r: number;
      rir: number;
    }[];
  }[],
  nextId: MockDB["nextId"],
): WorkoutSession & { user_id: string } {
  const startedAt = iso(daysAgo, 18, 0);
  const supersetMap = new Map<number, number>();
  const exercises = plan.map((p, idx) => {
    let supersetGroupId: number | null = null;
    if (p.supersetWith !== undefined) {
      if (!supersetMap.has(p.supersetWith)) {
        supersetMap.set(p.supersetWith, nextId.supersetGroup++);
      }
      supersetGroupId = supersetMap.get(p.supersetWith)!;
    }
    const workoutExerciseId = nextId.workoutExercise++;
    return {
      id: String(workoutExerciseId),
      exercise_id: String(p.exerciseId),
      order_index: idx,
      superset_group_id: supersetGroupId,
      sets: p.sets.map((s, si) => ({
        id: String(nextId.set++),
        set_number: si + 1,
        set_type: s.type,
        target_weight: s.w,
        target_reps: s.r,
        target_rir: s.rir,
        actual_weight: s.w,
        actual_reps: s.r,
        actual_rir: s.rir,
        completed: true,
        completed_at: iso(daysAgo, 18, 5 + si * 4),
      })),
    };
  });
  return {
    id: String(id),
    user_id: DEMO_USER_ID,
    split_id: splitId === null ? null : String(splitId),
    started_at: startedAt,
    completed_at: iso(daysAgo, 19, 10),
    notes: null,
    exercises,
  };
}

export function createSeedData(): MockDB {
  const nextId: MockDB["nextId"] = {
    user: 2,
    split: 4,
    workoutSession: 100,
    workoutExercise: 1000,
    set: 10000,
    supersetGroup: 1,
  };

  const splits: (Split & { user_id: string })[] = [
    {
      id: "1",
      user_id: DEMO_USER_ID,
      name: "Push Day",
      pic: null,
      muscles: [
        { muscle_id: muscleId("chest"), nr_of_exercises: 3 },
        { muscle_id: muscleId("shoulders"), nr_of_exercises: 2 },
        { muscle_id: muscleId("triceps"), nr_of_exercises: 1 },
      ],
    },
    {
      id: "2",
      user_id: DEMO_USER_ID,
      name: "Pull Day",
      pic: null,
      muscles: [
        // "Back" isn't one muscle in this catalog — lats has the deepest
        // exercise pool of the back muscles, so it stands in for the split.
        { muscle_id: muscleId("lats"), nr_of_exercises: 3 },
        { muscle_id: muscleId("biceps"), nr_of_exercises: 2 },
      ],
    },
    {
      id: "3",
      user_id: DEMO_USER_ID,
      name: "Leg Day",
      pic: null,
      muscles: [
        { muscle_id: muscleId("quadriceps"), nr_of_exercises: 2 },
        { muscle_id: muscleId("hamstrings"), nr_of_exercises: 2 },
        { muscle_id: muscleId("abdominals"), nr_of_exercises: 1 },
      ],
    },
  ];

  const sessions: (WorkoutSession & { user_id: string })[] = [
    buildHistorySession(
      nextId.workoutSession++,
      2,
      1,
      [
        {
          exerciseId: 10,
          sets: [
            { type: "warmup", w: 60, r: 10, rir: 4 },
            { type: "standard", w: 80, r: 8, rir: 2 },
            { type: "standard", w: 82.5, r: 7, rir: 1 },
            { type: "myorep", w: 75, r: 8, rir: 0 },
          ],
        },
        {
          exerciseId: 11,
          sets: [
            { type: "standard", w: 30, r: 10, rir: 2 },
            { type: "standard", w: 30, r: 9, rir: 1 },
          ],
        },
        {
          exerciseId: 31,
          supersetWith: 1,
          sets: [
            { type: "standard", w: 10, r: 15, rir: 1 },
            { type: "standard", w: 10, r: 14, rir: 0 },
          ],
        },
        {
          exerciseId: 30,
          sets: [
            { type: "standard", w: 45, r: 8, rir: 2 },
            { type: "standard", w: 45, r: 7, rir: 1 },
          ],
        },
        {
          exerciseId: 70,
          sets: [
            { type: "standard", w: 25, r: 12, rir: 1 },
            { type: "myorep", w: 25, r: 10, rir: 0 },
          ],
        },
      ],
      nextId,
    ),
    buildHistorySession(
      nextId.workoutSession++,
      4,
      2,
      [
        {
          exerciseId: 20,
          sets: [
            { type: "warmup", w: 80, r: 5, rir: 5 },
            { type: "standard", w: 120, r: 5, rir: 2 },
            { type: "standard", w: 130, r: 3, rir: 1 },
          ],
        },
        {
          exerciseId: 21,
          sets: [
            { type: "standard", w: 0, r: 10, rir: 2 },
            { type: "myorep", w: 0, r: 8, rir: 0 },
          ],
        },
        {
          exerciseId: 22,
          sets: [
            { type: "standard", w: 60, r: 10, rir: 2 },
            { type: "standard", w: 60, r: 9, rir: 1 },
          ],
        },
        {
          exerciseId: 60,
          sets: [
            { type: "standard", w: 20, r: 12, rir: 2 },
            { type: "standard", w: 20, r: 10, rir: 0 },
          ],
        },
      ],
      nextId,
    ),
    buildHistorySession(
      nextId.workoutSession++,
      6,
      3,
      [
        {
          exerciseId: 40,
          sets: [
            { type: "warmup", w: 60, r: 8, rir: 5 },
            { type: "standard", w: 100, r: 6, rir: 2 },
            { type: "standard", w: 105, r: 5, rir: 1 },
            { type: "drop", w: 80, r: 8, rir: 0 },
          ],
        },
        {
          exerciseId: 50,
          sets: [
            { type: "standard", w: 70, r: 10, rir: 2 },
            { type: "standard", w: 70, r: 9, rir: 1 },
          ],
        },
        {
          exerciseId: 80,
          sets: [
            { type: "standard", w: 0, r: 12, rir: 1 },
            { type: "standard", w: 0, r: 10, rir: 0 },
          ],
        },
      ],
      nextId,
    ),
    buildHistorySession(
      nextId.workoutSession++,
      9,
      1,
      [
        {
          exerciseId: 10,
          sets: [
            { type: "warmup", w: 60, r: 10, rir: 4 },
            { type: "standard", w: 77.5, r: 8, rir: 2 },
            { type: "standard", w: 80, r: 6, rir: 1 },
          ],
        },
        {
          exerciseId: 12,
          sets: [
            { type: "standard", w: 15, r: 14, rir: 2 },
            { type: "standard", w: 15, r: 12, rir: 1 },
          ],
        },
      ],
      nextId,
    ),
    buildHistorySession(
      nextId.workoutSession++,
      13,
      2,
      [
        {
          exerciseId: 20,
          sets: [
            { type: "warmup", w: 80, r: 5, rir: 5 },
            { type: "standard", w: 115, r: 5, rir: 2 },
            { type: "standard", w: 125, r: 3, rir: 1 },
          ],
        },
        {
          exerciseId: 23,
          sets: [
            { type: "standard", w: 55, r: 10, rir: 2 },
            { type: "standard", w: 55, r: 9, rir: 1 },
          ],
        },
      ],
      nextId,
    ),
  ];

  // one in-progress ad-hoc session (no completed_at) for continuity testing
  const inProgress: WorkoutSession & { user_id: string } = {
    id: String(nextId.workoutSession++),
    user_id: DEMO_USER_ID,
    split_id: null,
    started_at: iso(0, 7, 30),
    completed_at: null,
    notes: null,
    exercises: [],
  };
  sessions.push(inProgress);

  return {
    users: [
      {
        id: DEMO_USER_ID,
        email: "demo@overload.app",
        password: "demo1234",
        qr_code_url: null,
        profile_picture_url: null,
      },
    ],
    muscles: MUSCLES,
    exercises: EXERCISES,
    favorites: [
      { user_id: DEMO_USER_ID, exercise_id: "10" },
      { user_id: DEMO_USER_ID, exercise_id: "20" },
      { user_id: DEMO_USER_ID, exercise_id: "40" },
    ],
    splits,
    workoutSessions: sessions,
    nextId,
  };
}
