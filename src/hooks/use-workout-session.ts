import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as workoutsApi from "@/lib/api/workouts";
import type { SetInput } from "@/lib/api/workouts";

function invalidateSession(qc: ReturnType<typeof useQueryClient>, sessionId: number) {
  qc.invalidateQueries({ queryKey: ["workouts", sessionId] });
}

export function useAddExercise(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ exerciseId, orderIndex }: { exerciseId: number; orderIndex: number }) =>
      workoutsApi.addWorkoutExercise(sessionId, exerciseId, orderIndex),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useSwapExercise(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workoutExerciseId,
      exerciseId,
    }: {
      workoutExerciseId: number;
      exerciseId: number;
    }) => workoutsApi.swapWorkoutExercise(sessionId, workoutExerciseId, exerciseId),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useRemoveExercise(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workoutExerciseId: number) =>
      workoutsApi.deleteWorkoutExercise(sessionId, workoutExerciseId),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useCreateSuperset(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workoutExerciseIds: number[]) =>
      workoutsApi.createSuperset(sessionId, workoutExerciseIds),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useRemoveSuperset(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supersetGroupId: number) =>
      workoutsApi.deleteSuperset(sessionId, supersetGroupId),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useLogSet(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workoutExerciseId, input }: { workoutExerciseId: number; input: SetInput }) =>
      workoutsApi.createSet(workoutExerciseId, input),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function usePatchSet(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<SetInput> }) =>
      workoutsApi.patchSet(id, patch),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useDeleteSet(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => workoutsApi.deleteSet(id),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}
