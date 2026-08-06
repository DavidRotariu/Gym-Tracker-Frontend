import { apiRequest } from "./client";
import type { Exercise, ExerciseHistoryEntry, LastSet } from "@/types";

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

export interface ExerciseUpdateInput {
  name: string;
  muscle_id: string;
  equipment: string | null;
  tips: string | null;
}

/**
 * ponytail: the deployed API has no update endpoint yet (only GET/POST
 * /exercises) — this call 404s until the backend adds
 * `PATCH /exercises/{id}`. Wired up now so the UI just works the moment it
 * exists, no further frontend changes needed.
 */
export function updateExercise(exerciseId: string, input: ExerciseUpdateInput) {
  return apiRequest<Exercise>(`/exercises/${exerciseId}`, {
    method: "PATCH",
    body: input,
  });
}
