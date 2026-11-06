import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as workoutsApi from "@/lib/api/workouts";
import type { SetInput } from "@/lib/api/workouts";
import type { Set, WorkoutExercise, WorkoutSession } from "@/types";

/**
 * Optimistic rows are swapped for the server's real ones a beat later, and a
 * new id means a new React key — i.e. the row/card unmounts and remounts,
 * replaying its entrance (or exit + enter) animation. These record
 * real id → the optimistic id it replaced so the UI can keep using the
 * original as its *key* and the swap is invisible.
 */
export const setKeyAlias = new Map<string, string>();
export const exerciseKeyAlias = new Map<string, string>();

/** Shared by every write to one session — see sessionWrite(). */
export const sessionWriteKey = (sessionId: string) => ["session-write", sessionId];

/**
 * Every write to a session goes through one queue (a mutation `scope`):
 * `onMutate` still runs instantly, so the UI updates on the tap, but the
 * requests themselves reach the server one at a time, in tap order. Without
 * this, rapid taps (set type cycling, ✓/un-✓, keypad commits) raced each
 * other over the network and the server could end in a state the screen
 * never showed.
 *
 * The session is refetched once, when the queue drains — a refetch while
 * writes are still queued returns pre-write server state and visibly
 * reverts optimistic values.
 */
export function sessionWrite(qc: QueryClient, sessionId: string) {
  const mutationKey = sessionWriteKey(sessionId);
  return {
    mutationKey,
    scope: { id: `session-write-${sessionId}` },
    onSettled: () => {
      // The settling mutation still counts as pending at this point.
      if (qc.isMutating({ mutationKey }) <= 1) {
        qc.invalidateQueries({ queryKey: ["workouts", sessionId] });
      }
    },
  };
}

/**
 * Rollbacks are per entity (undo exactly what this mutation changed), never a
 * whole-session snapshot: with several writes in flight, restoring a
 * snapshot taken before them would wipe their optimistic changes too.
 */
function updateSession(
  qc: QueryClient,
  sessionId: string,
  fn: (session: WorkoutSession) => WorkoutSession,
) {
  qc.setQueryData<WorkoutSession>(["workouts", sessionId], (old) => (old ? fn(old) : old));
}

function updateExercises(
  qc: QueryClient,
  sessionId: string,
  fn: (exercises: WorkoutExercise[]) => WorkoutExercise[],
) {
  updateSession(qc, sessionId, (s) => ({ ...s, exercises: fn(s.exercises) }));
}

function cancelSession(qc: QueryClient, sessionId: string) {
  return qc.cancelQueries({ queryKey: ["workouts", sessionId] });
}

export function useAddExercise(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...sessionWrite(qc, sessionId),
    mutationFn: ({ exerciseId, orderIndex }: { exerciseId: string; orderIndex: number }) =>
      workoutsApi.addWorkoutExercise(sessionId, exerciseId, orderIndex),
    // The card appears in the same tick as the tap; the POST catches up.
    onMutate: async ({ exerciseId, orderIndex }) => {
      await cancelSession(qc, sessionId);
      const optimistic: WorkoutExercise = {
        id: `optimistic-${crypto.randomUUID()}`,
        exercise_id: exerciseId,
        order_index: orderIndex,
        superset_group_id: null,
        sets: [],
      };
      updateExercises(qc, sessionId, (list) => [...list, optimistic]);
      return { optimisticId: optimistic.id };
    },
    // Swap the placeholder for the real row right away — not on the queue's
    // final refetch — so it becomes usable (add set, swap, remove) as soon
    // as the server knows it.
    onSuccess: (created, _vars, context) => {
      exerciseKeyAlias.set(created.id, context.optimisticId);
      updateExercises(qc, sessionId, (list) =>
        list.map((we) =>
          we.id === context.optimisticId ? { ...created, sets: created.sets ?? [] } : we,
        ),
      );
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      updateExercises(qc, sessionId, (list) => list.filter((we) => we.id !== context.optimisticId));
    },
  });
}

export function useSwapExercise(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...sessionWrite(qc, sessionId),
    mutationFn: ({
      workoutExerciseId,
      exerciseId,
    }: {
      workoutExerciseId: string;
      exerciseId: string;
    }) => workoutsApi.swapWorkoutExercise(sessionId, workoutExerciseId, exerciseId),
    onMutate: async ({ workoutExerciseId, exerciseId }) => {
      await cancelSession(qc, sessionId);
      const before = qc
        .getQueryData<WorkoutSession>(["workouts", sessionId])
        ?.exercises.find((we) => we.id === workoutExerciseId);
      updateExercises(qc, sessionId, (list) =>
        list.map((we) =>
          we.id === workoutExerciseId ? { ...we, exercise_id: exerciseId, sets: [] } : we,
        ),
      );
      return { before };
    },
    onError: (_err, { workoutExerciseId, exerciseId }, context) => {
      const before = context?.before;
      if (!before) return;
      // Only undo if nothing else has changed this card since.
      updateExercises(qc, sessionId, (list) =>
        list.map((we) =>
          we.id === workoutExerciseId && we.exercise_id === exerciseId ? before : we,
        ),
      );
    },
  });
}

export function useRemoveExercise(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...sessionWrite(qc, sessionId),
    mutationFn: (workoutExerciseId: string) =>
      workoutsApi.deleteWorkoutExercise(sessionId, workoutExerciseId),
    // Optimistic: the card leaves on the tap, so there's nothing left to tap
    // a second time (a second DELETE used to 404 into an error toast).
    onMutate: async (workoutExerciseId) => {
      await cancelSession(qc, sessionId);
      const removed = qc
        .getQueryData<WorkoutSession>(["workouts", sessionId])
        ?.exercises.find((we) => we.id === workoutExerciseId);
      updateExercises(qc, sessionId, (list) => list.filter((we) => we.id !== workoutExerciseId));
      return { removed };
    },
    onError: (_err, _id, context) => {
      const removed = context?.removed;
      if (!removed) return;
      updateExercises(qc, sessionId, (list) =>
        list.some((we) => we.id === removed.id) ? list : [...list, removed],
      );
    },
  });
}

export function useCreateSuperset(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...sessionWrite(qc, sessionId),
    mutationFn: (workoutExerciseIds: string[]) =>
      workoutsApi.createSuperset(sessionId, workoutExerciseIds),
  });
}

export function useRemoveSuperset(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...sessionWrite(qc, sessionId),
    mutationFn: (supersetGroupId: number) =>
      workoutsApi.deleteSuperset(sessionId, supersetGroupId),
  });
}

/**
 * Optimistic, same reasoning as usePatchSets below: "Add set"/"Log first
 * set" otherwise waits on a full POST round trip before the new row shows
 * up, which reads as the tap having lagged or done nothing. A placeholder
 * row (temp id, everything else from `input`) appears in the same tick the
 * button is pressed and is replaced by the server's row once it's saved.
 */
export function useLogSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...sessionWrite(qc, sessionId),
    mutationFn: ({ workoutExerciseId, input }: { workoutExerciseId: string; input: SetInput }) =>
      workoutsApi.createSet(workoutExerciseId, input),
    onMutate: async ({ workoutExerciseId, input }) => {
      await cancelSession(qc, sessionId);
      const optimisticSet: Set = { id: `optimistic-${crypto.randomUUID()}`, completed_at: null, ...input };
      updateExercises(qc, sessionId, (list) =>
        list.map((we) =>
          we.id === workoutExerciseId ? { ...we, sets: [...we.sets, optimisticSet] } : we,
        ),
      );
      return { optimisticId: optimisticSet.id };
    },
    // Real row in immediately (it's editable from here on), not on the
    // queue's final refetch.
    onSuccess: (created, _vars, context) => {
      setKeyAlias.set(created.id, context.optimisticId);
      updateExercises(qc, sessionId, (list) =>
        list.map((we) => ({
          ...we,
          sets: we.sets.map((s) => (s.id === context.optimisticId ? created : s)),
        })),
      );
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      updateExercises(qc, sessionId, (list) =>
        list.map((we) => ({ ...we, sets: we.sets.filter((s) => s.id !== context.optimisticId) })),
      );
    },
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
 * later set touches several sets from a single keystroke's commit; batching
 * makes them all change on screen in the same instant.
 */
export function usePatchSets(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...sessionWrite(qc, sessionId),
    mutationFn: (updates: SetPatch[]) =>
      Promise.all(updates.map(({ id, patch }) => workoutsApi.patchSet(id, patch))),
    onMutate: async (updates) => {
      await cancelSession(qc, sessionId);
      const patchById = new Map(updates.map((u) => [u.id, u.patch]));
      // What each patched field held before — the undo for exactly this write.
      const undo: SetPatch[] = [];
      updateExercises(qc, sessionId, (list) =>
        list.map((we) => ({
          ...we,
          sets: we.sets.map((s) => {
            const patch = patchById.get(s.id);
            if (!patch) return s;
            const prev: Partial<SetInput> = {};
            for (const k of Object.keys(patch) as (keyof SetInput)[]) {
              (prev as Record<string, unknown>)[k] = (s as unknown as Record<string, unknown>)[k];
            }
            undo.push({ id: s.id, patch: prev });
            return { ...s, ...patch };
          }),
        })),
      );
      return { undo, patchById };
    },
    onError: (_err, _updates, context) => {
      if (!context) return;
      const undoById = new Map(context.undo.map((u) => [u.id, u.patch]));
      updateExercises(qc, sessionId, (list) =>
        list.map((we) => ({
          ...we,
          sets: we.sets.map((s) => {
            const prev = undoById.get(s.id);
            const wrote = context.patchById.get(s.id);
            if (!prev || !wrote) return s;
            // Revert a field only if it still shows what this write put
            // there — a later edit to the same field wins.
            const next = { ...s } as Record<string, unknown>;
            for (const [k, v] of Object.entries(prev)) {
              if (next[k] === (wrote as Record<string, unknown>)[k]) next[k] = v;
            }
            return next as unknown as Set;
          }),
        })),
      );
    },
  });
}

export function useDeleteSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...sessionWrite(qc, sessionId),
    mutationFn: (id: string) => workoutsApi.deleteSet(id),
    // Optimistic: the row leaves on the tap instead of springing back and
    // sitting there until a refetch (which read as "delete didn't work").
    onMutate: async (id) => {
      await cancelSession(qc, sessionId);
      const owner = qc
        .getQueryData<WorkoutSession>(["workouts", sessionId])
        ?.exercises.find((we) => we.sets.some((s) => s.id === id));
      const removed = owner?.sets.find((s) => s.id === id);
      updateExercises(qc, sessionId, (list) =>
        list.map((we) => ({ ...we, sets: we.sets.filter((s) => s.id !== id) })),
      );
      return { ownerId: owner?.id, removed };
    },
    onError: (_err, _id, context) => {
      const { ownerId, removed } = context ?? {};
      if (!ownerId || !removed) return;
      updateExercises(qc, sessionId, (list) =>
        list.map((we) =>
          we.id === ownerId && !we.sets.some((s) => s.id === removed.id)
            ? { ...we, sets: [...we.sets, removed] }
            : we,
        ),
      );
    },
  });
}
