import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as workoutsApi from "@/lib/api/workouts";
import type { SetInput } from "@/lib/api/workouts";
import type { Set, WorkoutExercise, WorkoutSession } from "@/types";

function invalidateSession(qc: ReturnType<typeof useQueryClient>, sessionId: string) {
  qc.invalidateQueries({ queryKey: ["workouts", sessionId] });
}

/**
 * Optimistic rows are swapped for the server's real ones a beat later, and a
 * new id means a new React key — i.e. the row/card unmounts and remounts,
 * replaying its entrance (or exit + enter) animation. These record
 * real id → the optimistic id it replaced so the UI can keep using the
 * original as its *key* and the swap is invisible.
 */
export const setKeyAlias = new Map<string, string>();
export const exerciseKeyAlias = new Map<string, string>();

export function useAddExercise(sessionId: string) {
  const qc = useQueryClient();
  const queryKey = ["workouts", sessionId];
  return useMutation({
    mutationFn: ({ exerciseId, orderIndex }: { exerciseId: string; orderIndex: number }) =>
      workoutsApi.addWorkoutExercise(sessionId, exerciseId, orderIndex),
    // The card appears in the same tick as the tap; the POST catches up.
    onMutate: async ({ exerciseId, orderIndex }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<WorkoutSession>(queryKey);
      const optimistic: WorkoutExercise = {
        id: `optimistic-${crypto.randomUUID()}`,
        exercise_id: exerciseId,
        order_index: orderIndex,
        superset_group_id: null,
        sets: [],
      };
      qc.setQueryData<WorkoutSession>(queryKey, (old) =>
        old ? { ...old, exercises: [...old.exercises, optimistic] } : old,
      );
      return { previous, optimisticId: optimistic.id };
    },
    onSuccess: (created, _vars, context) => {
      if (context) exerciseKeyAlias.set(created.id, context.optimisticId);
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
    },
    onSettled: () => invalidateSession(qc, sessionId),
  });
}

export function useSwapExercise(sessionId: string) {
  const qc = useQueryClient();
  const queryKey = ["workouts", sessionId];
  return useMutation({
    mutationFn: ({
      workoutExerciseId,
      exerciseId,
    }: {
      workoutExerciseId: string;
      exerciseId: string;
    }) => workoutsApi.swapWorkoutExercise(sessionId, workoutExerciseId, exerciseId),
    onMutate: async ({ workoutExerciseId, exerciseId }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<WorkoutSession>(queryKey);
      qc.setQueryData<WorkoutSession>(queryKey, (old) =>
        old
          ? {
              ...old,
              exercises: old.exercises.map((we) =>
                we.id === workoutExerciseId ? { ...we, exercise_id: exerciseId, sets: [] } : we,
              ),
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

/**
 * Optimistic, same reasoning as usePatchSets below: "Add set"/"Log first
 * set" otherwise waits on a full POST round trip before the new row shows
 * up, which reads as the tap having lagged or done nothing. A placeholder
 * row (temp id, everything else from `input`) appears in the same tick the
 * button is pressed; onSettled's invalidate then swaps it for the real one.
 */
export function useLogSet(sessionId: string) {
  const qc = useQueryClient();
  const queryKey = ["workouts", sessionId];
  return useMutation({
    mutationFn: ({ workoutExerciseId, input }: { workoutExerciseId: string; input: SetInput }) =>
      workoutsApi.createSet(workoutExerciseId, input),
    onMutate: async ({ workoutExerciseId, input }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<WorkoutSession>(queryKey);
      const optimisticSet: Set = { id: `optimistic-${crypto.randomUUID()}`, completed_at: null, ...input };
      qc.setQueryData<WorkoutSession>(queryKey, (old) =>
        old
          ? {
              ...old,
              exercises: old.exercises.map((we) =>
                we.id === workoutExerciseId ? { ...we, sets: [...we.sets, optimisticSet] } : we,
              ),
            }
          : old,
      );
      return { previous, optimisticId: optimisticSet.id };
    },
    onSuccess: (created, _vars, context) => {
      if (context) setKeyAlias.set(created.id, context.optimisticId);
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
    },
    onSettled: () => invalidateSession(qc, sessionId),
  });
}

export type SetPatch = { id: string; patch: Partial<SetInput> };

/**
 * Optimistic, unlike the other mutations here: editing a set's weight/reps
 * drives same-render follow-on reads (the forward-fill and "Add set" seed
 * in the session page both read `session.exercises[].sets` right off this
 * cache) — waiting for a server round trip before those saw the new value
 * made both feel broken/delayed even though the write itself was fine.
 *
 * Takes a *batch* of patches — one call, one cache write, one re-render —
 * rather than one mutation per set. Forward-filling weight/reps into every
 * later set touches several sets from a single keystroke's commit; firing
 * that as N separate mutations means N separate `onMutate`s racing their
 * own `cancelQueries` and landing in the cache at slightly different ticks,
 * so the later sets visibly light up one after another instead of together.
 * Batching collapses that into one atomic update, so a single-set edit and
 * an N-set forward-fill both just look like "pass an array of length N".
 */
export function usePatchSets(sessionId: string) {
  const qc = useQueryClient();
  const queryKey = ["workouts", sessionId];
  return useMutation({
    mutationFn: (updates: SetPatch[]) =>
      Promise.all(updates.map(({ id, patch }) => workoutsApi.patchSet(id, patch))),
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<WorkoutSession>(queryKey);
      const patchById = new Map(updates.map((u) => [u.id, u.patch]));
      qc.setQueryData<WorkoutSession>(queryKey, (old) =>
        old
          ? {
              ...old,
              exercises: old.exercises.map((we) => ({
                ...we,
                sets: we.sets.map((s) => {
                  const patch = patchById.get(s.id);
                  return patch ? { ...s, ...patch } : s;
                }),
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
