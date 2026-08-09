import { apiRequest } from "./client";
import { formatMuscleName } from "@/lib/format";
import type { Muscle } from "@/types";

/** Formats every name for display here, once, so every screen that reads
 *  from this list — and anything joined against it, like Exercise.muscle_id
 *  lookups — gets "Full body" instead of the API's raw "full_body". */
export async function getMuscles() {
  const muscles = await apiRequest<Muscle[]>("/muscles");
  return muscles.map((m) => ({ ...m, name: formatMuscleName(m.name) }));
}
