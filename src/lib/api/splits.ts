import { apiRequest } from "./client";
import type { Split, SplitMuscle } from "@/types";

export interface SplitInput {
  name: string;
  pic: string | null;
  muscles: SplitMuscle[];
}

export function getSplits() {
  return apiRequest<Split[]>("/splits");
}

export function getSplit(id: number) {
  return apiRequest<Split>(`/splits/${id}`);
}

export function createSplit(input: SplitInput) {
  return apiRequest<Split>("/splits", { method: "POST", body: input });
}

export function updateSplit(id: number, input: SplitInput) {
  return apiRequest<Split>(`/splits/${id}`, { method: "PUT", body: input });
}

export function deleteSplit(id: number) {
  return apiRequest<void>(`/splits/${id}`, { method: "DELETE" });
}
