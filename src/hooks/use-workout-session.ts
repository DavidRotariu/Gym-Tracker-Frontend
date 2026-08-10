import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as workoutsApi from "@/lib/api/workouts";
import type { SetInput } from "@/lib/api/workouts";
import type { WorkoutSession } from "@/types";

function invalidateSession(qc: ReturnType<typeof useQueryClient>, sessionId: string) {
  qc.invalidateQueries({ queryKey: ["workouts", sessionId] });
}

export function useAddExercise(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ exerciseId, orderIndex }: { exerciseId: string; orderIndex: number }) =>
      workoutsApi.addWorkoutExercise(sessionId, exerciseId, orderIndex),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useSwapExercise(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workoutExerciseId,
      exerciseId,
    }: {
      workoutExerciseId: string;
      exerciseId: string;
    }) => workoutsApi.swapWorkoutExercise(sessionId, workoutExerciseId, exerciseId),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useRemoveExercise(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workoutExerciseId: string) =>
      workoutsApi.deleteWorkoutExercise(sessionId, workoutExerciseId),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useCreateSuperset(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workoutExerciseIds: string[]) =>
      workoutsApi.createSuperset(sessionId, workoutExerciseIds),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useRemoveSuperset(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supersetGroupId: number) =>
      workoutsApi.deleteSuperset(sessionId, supersetGroupId),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

export function useLogSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workoutExerciseId, input }: { workoutExerciseId: string; input: SetInput }) =>
      workoutsApi.createSet(workoutExerciseId, input),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}

/**
 * Optimistic, unlike the other mutations here: editing a set's weight/reps
 * drives same-render follow-on reads (the forward-fill and "Add set" seed
 * in the session page both read `session.exercises[].sets` right off this
 * cache) — waiting for a server round trip before those saw the new value
 * made both feel broken/delayed even though the write itself was fine.
 */
export function usePatchSet(sessionId: string) {
  const qc = useQueryClient();
  const queryKey = ["workouts", sessionId];
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SetInput> }) =>
      workoutsApi.patchSet(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<WorkoutSession>(queryKey);
      qc.setQueryData<WorkoutSession>(queryKey, (old) =>
        old
          ? {
              ...old,
              exercises: old.exercises.map((we) => ({
                ...we,
                sets: we.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
              })),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
    },
    onSettled: () => invalidateSession(qc, sessionId),
  });
}

export function useDeleteSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workoutsApi.deleteSet(id),
    onSuccess: () => invalidateSession(qc, sessionId),
  });
}
