import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getExerciseHistory,
  getExercises,
  getLastSet,
  updateExercise,
  type ExerciseUpdateInput,
} from "@/lib/api/exercises";

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

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExerciseUpdateInput }) =>
      updateExercise(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}
