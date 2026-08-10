import { apiRequest } from "./client";
import { formatMuscleName, isTailMuscle } from "@/lib/format";
import type { Muscle } from "@/types";

/**
 * Formats every name for display here, once, so every screen that reads
 * from this list — and anything joined against it, like Exercise.muscle_id
 * lookups — gets "Full body" instead of the API's raw "full_body". Also
 * pushes cardio/full_body/other to the end here, once, so every consumer
 * (split muscle picker, exercise search filter, …) gets that order for
 * free instead of re-implementing it.
 */
export async function getMuscles() {
  const muscles = await apiRequest<Muscle[]>("/muscles");
  const ordered = [...muscles].sort((a, b) => {
    const aTail = isTailMuscle(a.name) ? 1 : 0;
    const bTail = isTailMuscle(b.name) ? 1 : 0;
    return aTail - bTail;
  });
  return ordered.map((m) => ({ ...m, name: formatMuscleName(m.name) }));
}
