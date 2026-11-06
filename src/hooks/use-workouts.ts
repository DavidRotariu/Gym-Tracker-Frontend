import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import * as workoutsApi from "@/lib/api/workouts";
import type { WorkoutPatch } from "@/lib/api/workouts";
import type { WorkoutSessionSummary } from "@/types";
import { sessionWrite, sessionWriteKey } from "./use-workout-session";

const historyQuery = {
  queryKey: ["workouts"],
  queryFn: () => workoutsApi.getWorkouts({ limit: 50 }),
};

export function useWorkoutHistory() {
  return useQuery(historyQuery);
}

export function useWorkout(id: string | null) {
  const qc = useQueryClient();
  // Coming back to the app (or back online) mid-write would refetch pre-write
  // server state over the optimistic values — the write queue's own drain
  // refetch (see sessionWrite) covers it instead.
  const idle = () => id === null || qc.isMutating({ mutationKey: sessionWriteKey(id) }) === 0;
  return useQuery({
    queryKey: ["workouts", id],
    queryFn: () => workoutsApi.getWorkout(id as string),
    enabled: id !== null,
    refetchOnWindowFocus: idle,
    refetchOnReconnect: idle,
  });
}

export function useStartWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (splitId: string | null) => workoutsApi.startWorkout(splitId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

/**
 * The one way to start a workout: resumes the in-progress session if there
 * is one instead of creating a second (orphaned) one, waits for the history
 * list if it hasn't loaded yet rather than assuming "none in progress", and
 * ignores a second tap while the first is still starting.
 */
export function useStartOrResumeWorkout() {
  const qc = useQueryClient();
  const router = useRouter();
  const start = useStartWorkout();
  const busy = useRef(false);

  async function run(
    splitId: string | null,
    opts: { replace?: boolean; onDone?: () => void } = {},
  ) {
    if (busy.current) return;
    busy.current = true;
    try {
      const history = await qc.ensureQueryData(historyQuery);
      const open = history.find((s) => !s.completed_at);
      const id = open ? open.id : (await start.mutateAsync(splitId)).id;
      opts.onDone?.();
      const url = `/workout/${id}`;
      if (opts.replace) router.replace(url);
      else router.push(url);
    } catch {
      // Surfaced through `start.error` / `start.isError` by the caller.
    } finally {
      busy.current = false;
    }
  }

  return { run, isPending: start.isPending, error: start.error };
}

export function usePatchWorkout(id: string) {
  const qc = useQueryClient();
  const write = sessionWrite(qc, id);
  return useMutation({
    // Same queue as the session's set writes, so Finish only lands after
    // every edit made before it has reached the server.
    mutationKey: write.mutationKey,
    scope: write.scope,
    mutationFn: (patch: WorkoutPatch) => workoutsApi.patchWorkout(id, patch),
    onSuccess: (_data, patch) => {
      // The home screen's "Resume workout" button reads the cached list, and
      // that query is inactive while you're on the workout page — invalidating
      // alone leaves a stale in-progress entry showing until refetch lands.
      // Write the change into the list directly so there's no stale window.
      qc.setQueryData<WorkoutSessionSummary[]>(["workouts"], (list) =>
        list?.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["workouts", id] });
    },
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workoutsApi.deleteWorkout(id),
    // Drop it from the cached list immediately so a discarded workout can't
    // keep showing up as "in progress" while the delete is in flight.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["workouts"], exact: true });
      const previous = qc.getQueryData<WorkoutSessionSummary[]>(["workouts"]);
      qc.setQueryData<WorkoutSessionSummary[]>(["workouts"], (list) =>
        list?.filter((s) => s.id !== id),
      );
      return { removed: previous?.find((s) => s.id === id) };
    },
    onError: (_err, _id, context) => {
      const removed = context?.removed;
      if (!removed) return;
      qc.setQueryData<WorkoutSessionSummary[]>(["workouts"], (list) =>
        list && !list.some((s) => s.id === removed.id) ? [...list, removed] : list,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["workouts"], exact: true }),
  });
}
