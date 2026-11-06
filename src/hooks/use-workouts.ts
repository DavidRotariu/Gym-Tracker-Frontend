import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as workoutsApi from "@/lib/api/workouts";
import type { WorkoutPatch } from "@/lib/api/workouts";
import type { WorkoutSessionSummary } from "@/types";

export function useWorkoutHistory() {
  return useQuery({
    queryKey: ["workouts"],
    queryFn: () => workoutsApi.getWorkouts({ limit: 50 }),
  });
}

export function useWorkout(id: string | null) {
  return useQuery({
    queryKey: ["workouts", id],
    queryFn: () => workoutsApi.getWorkout(id as string),
    enabled: id !== null,
  });
}

export function useStartWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (splitId: string | null) => workoutsApi.startWorkout(splitId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export function usePatchWorkout(id: string) {
  const qc = useQueryClient();
  return useMutation({
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
    onMutate: (id) => {
      qc.setQueryData<WorkoutSessionSummary[]>(["workouts"], (list) =>
        list?.filter((s) => s.id !== id),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}
