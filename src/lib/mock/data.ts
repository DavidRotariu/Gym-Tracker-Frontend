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
 * Muscle illustrations still ship locally under public/muscles (filenames as
 * provided — spaces/parens included, MediaThumb encodes the URL). Exercise
 * media moved to the cloud (image_url/video_url on Exercise) — the mock
 * backend has no local files to point at, so those come back null here;
 * MediaThumb already degrades to its fallback glyph when src is null.
 */
const MUSCLE_FILES: Record<string, string> = {
  Chest: "Chest.png",
  Back: "Back.png",
  Shoulders: "Shoulders.png",
  Quads: "Quadriceps.png",
  Hamstrings: "Hamstrings.png",
  Biceps: "Biceps.png",
  Triceps: "Triceps.png",
  Core: "Abs.png",
  Calves: "Calves.png",
  Forearms: "Forearms.png",
  Glutes: "Glutes.png",
};

const MUSCLES: Muscle[] = Object.keys(MUSCLE_FILES).map((name, i) => ({
  id: String(i + 1),
  name,
  pic: `/muscles/${MUSCLE_FILES[name]}`,
}));

const EXERCISE_NAMES: { id: number; name: string; muscle_id: number }[] = [
  // Chest
  { id: 10, name: "Barbell Bench Press", muscle_id: 1 },
  { id: 11, name: "Incline Dumbbell Press", muscle_id: 1 },
  { id: 12, name: "Cable Fly", muscle_id: 1 },
  { id: 13, name: "Push-Up", muscle_id: 1 },
  { id: 14, name: "Dumbbell Fly", muscle_id: 1 },
  { id: 15, name: "Smith Machine Bench Press", muscle_id: 1 },
  { id: 16, name: "Lever Chest Press", muscle_id: 1 },
  { id: 17, name: "Pec Deck Fly", muscle_id: 1 },
  // Back
  { id: 20, name: "Deadlift", muscle_id: 2 },
  { id: 21, name: "Pull-Up", muscle_id: 2 },
  { id: 22, name: "Barbell Row", muscle_id: 2 },
  { id: 23, name: "Lat Pulldown", muscle_id: 2 },
  { id: 24, name: "Seated Cable Row", muscle_id: 2 },
  { id: 25, name: "T-Bar Row", muscle_id: 2 },
  { id: 26, name: "Barbell Shrug", muscle_id: 2 },
  { id: 27, name: "Straight-Arm Pulldown", muscle_id: 2 },
  // Shoulders
  { id: 30, name: "Overhead Press", muscle_id: 3 },
  { id: 31, name: "Lateral Raise", muscle_id: 3 },
  { id: 32, name: "Rear Delt Fly", muscle_id: 3 },
  { id: 33, name: "Arnold Press", muscle_id: 3 },
  { id: 34, name: "Front Raise", muscle_id: 3 },
  { id: 35, name: "Upright Row", muscle_id: 3 },
  { id: 36, name: "Band Face Pull", muscle_id: 3 },
  // Quads
  { id: 40, name: "Back Squat", muscle_id: 4 },
  { id: 41, name: "Leg Press", muscle_id: 4 },
  { id: 42, name: "Walking Lunge", muscle_id: 4 },
  { id: 43, name: "Leg Extension", muscle_id: 4 },
  { id: 44, name: "Smith Machine Squat", muscle_id: 4 },
  { id: 45, name: "Goblet Squat", muscle_id: 4 },
  { id: 46, name: "Bulgarian Split Squat", muscle_id: 4 },
  // Hamstrings
  { id: 50, name: "Romanian Deadlift", muscle_id: 5 },
  { id: 51, name: "Lying Leg Curl", muscle_id: 5 },
  { id: 52, name: "Seated Leg Curl", muscle_id: 5 },
  { id: 53, name: "Glute Ham Raise", muscle_id: 5 },
  // Biceps
  { id: 60, name: "Barbell Curl", muscle_id: 6 },
  { id: 61, name: "Hammer Curl", muscle_id: 6 },
  { id: 62, name: "Concentration Curl", muscle_id: 6 },
  { id: 63, name: "Preacher Curl", muscle_id: 6 },
  { id: 64, name: "Cable Curl", muscle_id: 6 },
  { id: 65, name: "EZ-Bar Curl", muscle_id: 6 },
  // Triceps
  { id: 70, name: "Triceps Pushdown", muscle_id: 7 },
  { id: 71, name: "Skull Crusher", muscle_id: 7 },
  { id: 72, name: "Diamond Push-Up", muscle_id: 7 },
  { id: 73, name: "Overhead Triceps Extension", muscle_id: 7 },
  { id: 74, name: "Close-Grip Bench Press", muscle_id: 7 },
  { id: 75, name: "Seated Dip", muscle_id: 7 },
  // Core
  { id: 80, name: "Hanging Leg Raise", muscle_id: 8 },
  { id: 81, name: "Cable Crunch", muscle_id: 8 },
  { id: 82, name: "Plank", muscle_id: 8 },
  { id: 83, name: "Lying Leg Raise", muscle_id: 8 },
  { id: 84, name: "Russian Twist", muscle_id: 8 },
  { id: 85, name: "L-Sit", muscle_id: 8 },
  // Calves
  { id: 90, name: "Standing Calf Raise", muscle_id: 9 },
  { id: 91, name: "Lever Standing Calf Raise", muscle_id: 9 },
  { id: 92, name: "Smith Machine Calf Raise", muscle_id: 9 },
  // Forearms
  { id: 100, name: "Barbell Reverse Wrist Curl", muscle_id: 10 },
  { id: 101, name: "Cable Hammer Curl", muscle_id: 10 },
  { id: 102, name: "Barbell Reverse Curl", muscle_id: 10 },
  // Glutes
  { id: 110, name: "Barbell Hip Thrust", muscle_id: 11 },
  { id: 111, name: "Lever Hip Thrust", muscle_id: 11 },
  { id: 112, name: "Hyperextension", muscle_id: 11 },
];

const MUSCLE_BY_INDEX = new Map(MUSCLES.map((m, i) => [i + 1, m]));

/** Movements with no external load — everything else defaults to "weighted". */
const BODY_WEIGHT_EXERCISE_IDS = new Set([13, 21, 72, 80, 82, 83, 85]);

/**
 * Secondary muscles worked by each exercise, by muscle index (see MUSCLES).
 * Not exhaustive — a representative subset of the catalog, same ~40% split
 * the real dataset has (65/149 exercises carry at least one).
 */
const SECONDARY_MUSCLE_IDS: Record<number, number[]> = {
  10: [3, 7], // Bench Press: shoulders, triceps
  11: [3, 7],
  15: [3, 7],
  16: [3, 7],
  17: [3],
  20: [5, 11], // Deadlift: hamstrings, glutes
  21: [6], // Pull-Up: biceps
  22: [6],
  23: [6],
  24: [6],
  25: [6],
  40: [11, 5], // Back Squat: glutes, hamstrings
  41: [11],
  42: [11],
  44: [11],
  45: [11],
  46: [11],
  50: [11], // Romanian Deadlift: glutes
  60: [10], // Barbell Curl: forearms
  63: [10],
  65: [10],
  74: [1], // Close-Grip Bench Press: chest
  75: [1, 7], // Seated Dip: chest, triceps
  110: [5], // Hip Thrust: hamstrings
  111: [5],
  112: [5],
};

const EXERCISES: Exercise[] = EXERCISE_NAMES.map((e) => ({
  id: String(e.id),
  name: e.name,
  muscle_id: String(e.muscle_id),
  exercise_type: (BODY_WEIGHT_EXERCISE_IDS.has(e.id)
    ? "body_weight"
    : "weighted") as ExerciseType,
  image_url: null,
  video_url: null,
  rest_time: 90,
  tips: null,
  equipment: null,
  favourite: false,
  primary_muscle: MUSCLE_BY_INDEX.get(e.muscle_id)?.name ?? "",
  secondary_muscles: (SECONDARY_MUSCLE_IDS[e.id] ?? [])
    .map((mid) => MUSCLE_BY_INDEX.get(mid))
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
      type: "warmup" | "standard" | "drop" | "failure";
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
        { muscle_id: "1", nr_of_exercises: 3 },
        { muscle_id: "3", nr_of_exercises: 2 },
        { muscle_id: "7", nr_of_exercises: 1 },
      ],
    },
    {
      id: "2",
      user_id: DEMO_USER_ID,
      name: "Pull Day",
      pic: null,
      muscles: [
        { muscle_id: "2", nr_of_exercises: 3 },
        { muscle_id: "6", nr_of_exercises: 2 },
      ],
    },
    {
      id: "3",
      user_id: DEMO_USER_ID,
      name: "Leg Day",
      pic: null,
      muscles: [
        { muscle_id: "4", nr_of_exercises: 2 },
        { muscle_id: "5", nr_of_exercises: 2 },
        { muscle_id: "8", nr_of_exercises: 1 },
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
            { type: "failure", w: 75, r: 8, rir: 0 },
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
            { type: "failure", w: 25, r: 10, rir: 0 },
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
            { type: "failure", w: 0, r: 8, rir: 0 },
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
