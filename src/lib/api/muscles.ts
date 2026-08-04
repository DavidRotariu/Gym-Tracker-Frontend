import { apiRequest } from "./client";
import type { Muscle } from "@/types";

export function getMuscles() {
  return apiRequest<Muscle[]>("/muscles");
}
