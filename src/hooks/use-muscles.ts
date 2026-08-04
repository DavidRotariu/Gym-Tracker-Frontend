import { useQuery } from "@tanstack/react-query";
import { getMuscles } from "@/lib/api/muscles";

export function useMuscles() {
  return useQuery({ queryKey: ["muscles"], queryFn: getMuscles });
}
