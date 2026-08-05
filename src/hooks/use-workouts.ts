import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as workoutsApi from "@/lib/api/workouts";
import type { WorkoutPatch } from "@/lib/api/workouts";

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["workouts", id] });
    },
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workoutsApi.deleteWorkout(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}
