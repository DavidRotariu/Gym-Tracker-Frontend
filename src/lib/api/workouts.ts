import { apiRequest } from "./client";
import type { Set, SetType, WorkoutExercise, WorkoutSession, WorkoutSessionSummary } from "@/types";

export function startWorkout(splitId: number | null) {
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

export function getWorkout(id: number) {
  return apiRequest<WorkoutSession>(`/workouts/${id}`);
}

export interface WorkoutPatch {
  completed_at?: string;
  notes?: string;
  started_at?: string;
}

export function patchWorkout(id: number, patch: WorkoutPatch) {
  return apiRequest<WorkoutSession>(`/workouts/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

export function deleteWorkout(id: number) {
  return apiRequest<void>(`/workouts/${id}`, { method: "DELETE" });
}

export function addWorkoutExercise(
  workoutId: number,
  exerciseId: number,
  orderIndex: number,
) {
  return apiRequest<WorkoutExercise>(`/workouts/${workoutId}/exercises`, {
    method: "POST",
    body: { exercise_id: exerciseId, order_index: orderIndex },
  });
}

export function swapWorkoutExercise(
  workoutId: number,
  workoutExerciseId: number,
  exerciseId: number,
) {
  return apiRequest<WorkoutExercise>(
    `/workouts/${workoutId}/exercises/${workoutExerciseId}`,
    { method: "PATCH", body: { exercise_id: exerciseId } },
  );
}

export function deleteWorkoutExercise(
  workoutId: number,
  workoutExerciseId: number,
) {
  return apiRequest<void>(
    `/workouts/${workoutId}/exercises/${workoutExerciseId}`,
    { method: "DELETE" },
  );
}

export function createSuperset(workoutId: number, workoutExerciseIds: number[]) {
  return apiRequest<{ superset_group_id: number }>(
    `/workouts/${workoutId}/supersets`,
    { method: "POST", body: { workout_exercise_ids: workoutExerciseIds } },
  );
}

export function deleteSuperset(workoutId: number, supersetGroupId: number) {
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

export function createSet(workoutExerciseId: number, input: SetInput) {
  return apiRequest<Set>(`/workout-exercises/${workoutExerciseId}/sets`, {
    method: "POST",
    body: input,
  });
}

export function patchSet(id: number, patch: Partial<SetInput>) {
  return apiRequest<Set>(`/sets/${id}`, { method: "PATCH", body: patch });
}

export function deleteSet(id: number) {
  return apiRequest<void>(`/sets/${id}`, { method: "DELETE" });
}
