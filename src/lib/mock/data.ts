import type {
  Exercise,
  Muscle,
  Split,
  User,
  WorkoutSession,
} from "@/types";

export interface MockUser extends User {
  password: string;
  qr_code_url: string | null;
}

export interface MockDB {
  users: MockUser[];
  muscles: Muscle[];
  exercises: Exercise[];
  favorites: { user_id: number; exercise_id: number }[];
  splits: (Split & { user_id: number })[];
  workoutSessions: (WorkoutSession & { user_id: number })[];
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
 * Real asset library dropped in under public/muscles and public/exercises
 * (filenames as provided — spaces/parens included, MediaThumb encodes the
 * URL). Anything not mapped here just falls back to a plain glyph.
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
};

const MUSCLES: Muscle[] = Object.keys(MUSCLE_FILES).map((name, i) => ({
  id: i + 1,
  name,
  image_url: `/muscles/${MUSCLE_FILES[name]}`,
}));

const EXERCISE_FILES: Record<number, string> = {
  10: "00251201-Barbell-Bench-Press_Chest.mp4",
  11: "03141201-Dumbbell-Incline-Bench-Press_Chest.mp4",
  12: "01791201-Cable-Low-Fly_Chest.mp4",
  20: "00321201-Barbell-Deadlift_Hips-FIX.mp4",
  21: "08411101-Weighted-Pull-Up_back_small.jpg",
  22: "00271201-Barbell-Bent-Over-Row_Back.mp4",
  23: "01501201-Cable-Bar-Lateral-Pulldown_Back.mp4",
  30: "04261201-Dumbbell-Standing-Overhead-Press_shoulder.mp4",
  31: "03341201-Dumbbell-Lateral-Raise_shoulder.mp4",
  32: "06021201-Lever-Seated-Reverse-Fly_Shoulders.mp4",
  40: "00431201-Barbell-Full-Squat_Thighs.mp4",
  41: "22671201-Lever-Seated-Leg-Press_Thighs.mp4",
  42: "15571201-Dumbbell-Walking-Lunges_Thighs_.mp4",
  50: "14591201-Dumbbell-Romanian-Deadlift_Hips.mp4",
  51: "05861201-Lever-Lying-Leg-Curl_Thighs.mp4",
  60: "00311201-Barbell-Curl_Upper-Arms.mp4",
  61: "03121201-Dumbbell-Hammer-Curl-(version-2)_Upper-Arms.mp4",
  70: "02011201-Cable-Pushdown_Upper-Arms.mp4",
  71: "03511101-Dumbbell-Lying-Triceps-Extension_Upper-Arms_small.jpg",
  80: "17641201-Hanging-Leg-Hip-Raise_Waist.mp4",
  81: "01751201-Cable-Kneeling-Crunch_Waist.mp4",
};

const EXERCISE_NAMES: { id: number; name: string; muscle_id: number }[] = [
  { id: 10, name: "Barbell Bench Press", muscle_id: 1 },
  { id: 11, name: "Incline Dumbbell Press", muscle_id: 1 },
  { id: 12, name: "Cable Fly", muscle_id: 1 },
  { id: 20, name: "Deadlift", muscle_id: 2 },
  { id: 21, name: "Pull-Up", muscle_id: 2 },
  { id: 22, name: "Barbell Row", muscle_id: 2 },
  { id: 23, name: "Lat Pulldown", muscle_id: 2 },
  { id: 30, name: "Overhead Press", muscle_id: 3 },
  { id: 31, name: "Lateral Raise", muscle_id: 3 },
  { id: 32, name: "Rear Delt Fly", muscle_id: 3 },
  { id: 40, name: "Back Squat", muscle_id: 4 },
  { id: 41, name: "Leg Press", muscle_id: 4 },
  { id: 42, name: "Walking Lunge", muscle_id: 4 },
  { id: 50, name: "Romanian Deadlift", muscle_id: 5 },
  { id: 51, name: "Leg Curl", muscle_id: 5 },
  { id: 60, name: "Barbell Curl", muscle_id: 6 },
  { id: 61, name: "Hammer Curl", muscle_id: 6 },
  { id: 70, name: "Triceps Pushdown", muscle_id: 7 },
  { id: 71, name: "Skull Crusher", muscle_id: 7 },
  { id: 80, name: "Hanging Leg Raise", muscle_id: 8 },
  { id: 81, name: "Cable Crunch", muscle_id: 8 },
];

const EXERCISES: Exercise[] = EXERCISE_NAMES.map((e) => ({
  ...e,
  image_url: EXERCISE_FILES[e.id] ? `/exercises/${EXERCISE_FILES[e.id]}` : null,
}));

const DEMO_USER_ID = 1;

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
): WorkoutSession & { user_id: number } {
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
      id: workoutExerciseId,
      exercise_id: p.exerciseId,
      order_index: idx,
      superset_group_id: supersetGroupId,
      sets: p.sets.map((s, si) => ({
        id: nextId.set++,
        workout_exercise_id: workoutExerciseId,
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
    id,
    user_id: DEMO_USER_ID,
    split_id: splitId,
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

  const splits: (Split & { user_id: number })[] = [
    {
      id: 1,
      user_id: DEMO_USER_ID,
      name: "Push Day",
      pic: null,
      muscles: [
        { muscle_id: 1, nr_of_exercises: 3 },
        { muscle_id: 3, nr_of_exercises: 2 },
        { muscle_id: 7, nr_of_exercises: 1 },
      ],
    },
    {
      id: 2,
      user_id: DEMO_USER_ID,
      name: "Pull Day",
      pic: null,
      muscles: [
        { muscle_id: 2, nr_of_exercises: 3 },
        { muscle_id: 6, nr_of_exercises: 2 },
      ],
    },
    {
      id: 3,
      user_id: DEMO_USER_ID,
      name: "Leg Day",
      pic: null,
      muscles: [
        { muscle_id: 4, nr_of_exercises: 2 },
        { muscle_id: 5, nr_of_exercises: 2 },
        { muscle_id: 8, nr_of_exercises: 1 },
      ],
    },
  ];

  const sessions: (WorkoutSession & { user_id: number })[] = [
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
  const inProgress: WorkoutSession & { user_id: number } = {
    id: nextId.workoutSession++,
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
      },
    ],
    muscles: MUSCLES,
    exercises: EXERCISES,
    favorites: [
      { user_id: DEMO_USER_ID, exercise_id: 10 },
      { user_id: DEMO_USER_ID, exercise_id: 20 },
      { user_id: DEMO_USER_ID, exercise_id: 40 },
    ],
    splits,
    workoutSessions: sessions,
    nextId,
  };
}
