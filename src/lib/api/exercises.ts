import { apiRequest } from "./client";
import { formatMuscleName } from "@/lib/format";
import type { Exercise, ExerciseHistoryEntry, ExerciseType, LastSet } from "@/types";

/**
 * Muscle names arrive raw/lowercase both standalone (GET /muscles) and
 * embedded on an Exercise (primary_muscle, secondary_muscles) — format the
 * embedded copies here since they don't pass through getMuscles().
 *
 * `secondary_muscles` defaults to `[]` rather than trusting it's always an
 * array — this was exactly the bug: a response missing/nulling that field
 * threw inside this map and failed *every* exercise in the list, not just
 * the one row, because one bad element crashes the whole batch .map() call.
 */
function formatExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    primary_muscle: formatMuscleName(exercise.primary_muscle),
    secondary_muscles: (exercise.secondary_muscles ?? []).map((m) => ({
      ...m,
      name: formatMuscleName(m.name),
    })),
  };
}

export async function getExercises(muscleId?: string) {
  const qs = muscleId ? `?muscle_id=${muscleId}` : "";
  const exercises = await apiRequest<Exercise[]>(`/exercises${qs}`);
  return exercises.map(formatExercise);
}

export function getExerciseHistory(
  exerciseId: string,
  opts?: { limit?: number; before?: string },
) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.before) params.set("before", opts.before);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<ExerciseHistoryEntry[]>(
    `/exercises/${exerciseId}/history${qs}`,
  );
}

export async function getLastSet(exerciseId: string) {
  return apiRequest<LastSet | null>(`/exercises/${exerciseId}/last-set`);
}

/** Any subset of these fields — PATCH only touches what's included. */
export interface ExerciseUpdateInput {
  name?: string;
  thumbnail_url?: string | null;
  video_url?: string | null;
  muscle_id?: string;
  exercise_type?: ExerciseType;
  rest_time?: number;
  equipment?: string | null;
  tips?: string | null;
  favorite?: boolean;
  /** Replaces the full set of secondary-muscle associations. */
  secondary_muscles?: string[];
}

export async function updateExercise(exerciseId: string, input: ExerciseUpdateInput) {
  const exercise = await apiRequest<Exercise>(`/exercises/${exerciseId}`, {
    method: "PATCH",
    body: input,
  });
  return formatExercise(exercise);
}
