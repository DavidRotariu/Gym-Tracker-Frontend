import { useQuery } from "@tanstack/react-query";
import { getExerciseHistory, getExercises, getLastSet } from "@/lib/api/exercises";

export function useExercises(muscleId?: number) {
  return useQuery({
    queryKey: ["exercises", muscleId ?? "all"],
    queryFn: () => getExercises(muscleId),
  });
}

export function useExerciseHistory(exerciseId: number | null) {
  return useQuery({
    queryKey: ["exercise-history", exerciseId],
    queryFn: () => getExerciseHistory(exerciseId as number),
    enabled: exerciseId !== null,
  });
}

export function useLastSet(exerciseId: number | null) {
  return useQuery({
    queryKey: ["last-set", exerciseId],
    queryFn: () => getLastSet(exerciseId as number),
    enabled: exerciseId !== null,
  });
}
