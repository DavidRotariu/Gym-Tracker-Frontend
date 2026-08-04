import { apiRequest } from "./client";
import type { Exercise, ExerciseHistoryEntry, LastSet } from "@/types";

export function getExercises(muscleId?: number) {
  const qs = muscleId ? `?muscle_id=${muscleId}` : "";
  return apiRequest<Exercise[]>(`/exercises${qs}`);
}

export function getExerciseHistory(
  exerciseId: number,
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

export async function getLastSet(exerciseId: number) {
  return apiRequest<LastSet | null>(`/exercises/${exerciseId}/last-set`);
}
