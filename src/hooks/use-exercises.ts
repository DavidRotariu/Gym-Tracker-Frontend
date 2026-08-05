import { useQuery } from "@tanstack/react-query";
import { getExerciseHistory, getExercises, getLastSet } from "@/lib/api/exercises";

export function useExercises(muscleId?: string) {
  return useQuery({
    queryKey: ["exercises", muscleId ?? "all"],
    queryFn: () => getExercises(muscleId),
  });
}

export function useExerciseHistory(exerciseId: string | null) {
  return useQuery({
    queryKey: ["exercise-history", exerciseId],
    queryFn: () => getExerciseHistory(exerciseId as string),
    enabled: exerciseId !== null,
  });
}

export function useLastSet(exerciseId: string | null) {
  return useQuery({
    queryKey: ["last-set", exerciseId],
    queryFn: () => getLastSet(exerciseId as string),
    enabled: exerciseId !== null,
  });
}
