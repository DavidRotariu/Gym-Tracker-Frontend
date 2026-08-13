export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export interface Muscle {
  id: string;
  name: string;
  pic: string | null;
}

export type ExerciseType = "body_weight" | "weighted" | "negative" | "timer";

export interface Exercise {
  id: string;
  name: string;
  muscle_id: string;
  exercise_type: ExerciseType;
  /** Small still, cloud-hosted — icon-sized uses (search rows, lists). */
  thumbnail_url: string | null;
  /** Demo clip, cloud-hosted — card and bigger-view uses. */
  video_url: string | null;
  /** Rest time in seconds to prefill after logging a set of this exercise. */
  rest_time: number;
  tips: string | null;
  equipment: string | null;
  favourite: boolean;
  primary_muscle: string;
  secondary_muscles: Muscle[];
}

export interface SplitMuscle {
  muscle_id: string;
  nr_of_exercises: number;
}

export interface Split {
  id: string;
  name: string;
  pic: string | null;
  muscles: SplitMuscle[];
}

export type SetType = "standard" | "warmup" | "drop" | "myorep";

export interface Set {
  id: string;
  set_number: number;
  set_type: SetType;
  target_weight: number | null;
  target_reps: number | null;
  target_rir: number | null;
  actual_weight: number | null;
  actual_reps: number | null;
  actual_rir: number | null;
  completed: boolean;
  completed_at: string | null;
}

export interface WorkoutExercise {
  id: string;
  exercise_id: string;
  order_index: number;
  superset_group_id: number | null;
  sets: Set[];
}

export interface WorkoutSession {
  id: string;
  split_id: string | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  exercises: WorkoutExercise[];
}

export interface WorkoutSessionSummary {
  id: string;
  split_id: string | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface ExerciseHistoryEntry {
  workout_session_id: string;
  date: string;
  sets: Pick<
    Set,
    "set_number" | "set_type" | "actual_weight" | "actual_reps" | "actual_rir"
  >[];
}

export interface LastSet {
  actual_weight: number | null;
  actual_reps: number | null;
  actual_rir: number | null;
  logged_at: string;
}

/**
 * The deployed API wraps every error as {error: {code, message}} — verified
 * against the live Lambda, which does NOT match the generic FastAPI
 * {detail: ...} shape shown in its own Swagger examples.
 */
export interface ApiError {
  error: { code: string; message: string };
}
