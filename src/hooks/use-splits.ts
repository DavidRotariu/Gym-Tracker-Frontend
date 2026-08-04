import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as splitsApi from "@/lib/api/splits";
import type { SplitInput } from "@/lib/api/splits";

export function useSplits() {
  return useQuery({ queryKey: ["splits"], queryFn: splitsApi.getSplits });
}

export function useSplit(id: number | null) {
  return useQuery({
    queryKey: ["splits", id],
    queryFn: () => splitsApi.getSplit(id as number),
    enabled: id !== null,
  });
}

export function useCreateSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SplitInput) => splitsApi.createSplit(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["splits"] }),
  });
}

export function useUpdateSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SplitInput }) =>
      splitsApi.updateSplit(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["splits"] }),
  });
}

export function useDeleteSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => splitsApi.deleteSplit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["splits"] }),
  });
}
