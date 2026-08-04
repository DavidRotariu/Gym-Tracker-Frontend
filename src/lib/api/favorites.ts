import { apiRequest } from "./client";

export function addFavorite(exerciseId: number) {
  return apiRequest<void>("/favorites", {
    method: "POST",
    body: { exercise_id: exerciseId },
  });
}

export function removeFavorite(exerciseId: number) {
  return apiRequest<void>(`/favorites/${exerciseId}`, { method: "DELETE" });
}
