import { apiRequest } from "./client";
import type { Set, SetType, WorkoutExercise, WorkoutSession, WorkoutSessionSummary } from "@/types";

export function startWorkout(splitId: string | null) {
  return apiRequest<WorkoutSession>("/workouts", {
    method: "POST",
    body: { split_id: splitId },
  });
}

export function getWorkouts(opts?: { limit?: number; before?: string }) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.before) params.set("before", opts.before);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<WorkoutSessionSummary[]>(`/workouts${qs}`);
}

export function getWorkout(id: string) {
  return apiRequest<WorkoutSession>(`/workouts/${id}`);
}

export interface WorkoutPatch {
  completed_at?: string;
  notes?: string;
  started_at?: string;
}

export function patchWorkout(id: string, patch: WorkoutPatch) {
  return apiRequest<WorkoutSession>(`/workouts/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

export function deleteWorkout(id: string) {
  return apiRequest<void>(`/workouts/${id}`, { method: "DELETE" });
}

export function addWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  orderIndex: number,
) {
  return apiRequest<WorkoutExercise>(`/workouts/${workoutId}/exercises`, {
    method: "POST",
    body: { exercise_id: exerciseId, order_index: orderIndex },
  });
}

export function swapWorkoutExercise(
  workoutId: string,
  workoutExerciseId: string,
  exerciseId: string,
) {
  return apiRequest<WorkoutExercise>(
    `/workouts/${workoutId}/exercises/${workoutExerciseId}`,
    { method: "PATCH", body: { exercise_id: exerciseId } },
  );
}

export function deleteWorkoutExercise(
  workoutId: string,
  workoutExerciseId: string,
) {
  return apiRequest<void>(
    `/workouts/${workoutId}/exercises/${workoutExerciseId}`,
    { method: "DELETE" },
  );
}

export function createSuperset(workoutId: string, workoutExerciseIds: string[]) {
  return apiRequest<{ superset_group_id: number }>(
    `/workouts/${workoutId}/supersets`,
    { method: "POST", body: { workout_exercise_ids: workoutExerciseIds } },
  );
}

export function deleteSuperset(workoutId: string, supersetGroupId: number) {
  return apiRequest<void>(
    `/workouts/${workoutId}/supersets/${supersetGroupId}`,
    { method: "DELETE" },
  );
}

export interface SetInput {
  set_number: number;
  set_type: SetType;
  target_weight: number | null;
  target_reps: number | null;
  target_rir: number | null;
  actual_weight: number | null;
  actual_reps: number | null;
  actual_rir: number | null;
  completed: boolean;
}

export function createSet(workoutExerciseId: string, input: SetInput) {
  return apiRequest<Set>(`/workout-exercises/${workoutExerciseId}/sets`, {
    method: "POST",
    body: input,
  });
}

export function patchSet(id: string, patch: Partial<SetInput>) {
  return apiRequest<Set>(`/sets/${id}`, { method: "PATCH", body: patch });
}

export function deleteSet(id: string) {
  return apiRequest<void>(`/sets/${id}`, { method: "DELETE" });
}
