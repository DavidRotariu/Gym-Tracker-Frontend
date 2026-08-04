export interface User {
  id: number;
  email: string;
}

export interface Muscle {
  id: number;
  name: string;
  /** Illustration shown on muscle-group cards. Mock-only extension — not
   *  yet in API_ARCHITECTURE.md; falls back to a plain initial when absent. */
  image_url?: string | null;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_id: number;
  /** Demo GIF/photo shown while picking and logging. Mock-only extension —
   *  not yet in API_ARCHITECTURE.md; falls back to a plain glyph when absent. */
  image_url?: string | null;
}

export interface SplitMuscle {
  muscle_id: number;
  nr_of_exercises: number;
}

export interface Split {
  id: number;
  name: string;
  pic: string | null;
  muscles: SplitMuscle[];
}

export interface Favorite {
  user_id: number;
  exercise_id: number;
}

export type SetType = "standard" | "warmup" | "drop" | "failure";

export interface Set {
  id: number;
  workout_exercise_id: number;
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
  id: number;
  exercise_id: number;
  order_index: number;
  superset_group_id: number | null;
  sets: Set[];
}

export interface WorkoutSession {
  id: number;
  split_id: number | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  exercises: WorkoutExercise[];
}

export interface WorkoutSessionSummary {
  id: number;
  split_id: number | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface ExerciseHistoryEntry {
  workout_session_id: number;
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

export interface ApiError {
  error: { code: string; message: string };
}
