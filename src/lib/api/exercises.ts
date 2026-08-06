import { apiRequest } from "./client";
import type { Exercise, ExerciseHistoryEntry, ExerciseType, LastSet } from "@/types";

export function getExercises(muscleId?: string) {
  const qs = muscleId ? `?muscle_id=${muscleId}` : "";
  return apiRequest<Exercise[]>(`/exercises${qs}`);
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
  pic?: string | null;
  muscle_id?: string;
  exercise_type?: ExerciseType;
  equipment?: string | null;
  tips?: string | null;
  favorite?: boolean;
  /** Replaces the full set of secondary-muscle associations. */
  secondary_muscles?: string[];
}

export function updateExercise(exerciseId: string, input: ExerciseUpdateInput) {
  return apiRequest<Exercise>(`/exercises/${exerciseId}`, {
    method: "PATCH",
    body: input,
  });
}
