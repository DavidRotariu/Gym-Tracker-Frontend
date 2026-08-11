"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import * as favoritesApi from "@/lib/api/favorites";

export function useAddFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exerciseId: string) => favoritesApi.addFavorite(exerciseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exerciseId: string) => favoritesApi.removeFavorite(exerciseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });
}

const STORAGE_KEY = "overload_favorites";

/**
 * The API exposes POST/DELETE /favorites but no GET, so there is no way to
 * read the current favourites back. We still write through to the server and
 * mirror the state locally so callers can render it. Drop the mirror once a
 * GET /favorites endpoint exists.
 */
export function readFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeFavoriteIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/**
 * Fire-and-forget: favourite an exercise the first time it's actually
 * trained (a set gets marked complete), so "done before" and "liked" are
 * the same signal — no separate auto-favourite flag to maintain, and it
 * reuses the same list the picker sorts/badges by. No-op once the id is
 * already favourited, so it's safe to call on every set completion.
 */
export function markExerciseTrained(exerciseId: string) {
  if (typeof window === "undefined") return;
  const current = readFavoriteIds();
  if (current.includes(exerciseId)) return;
  writeFavoriteIds([...current, exerciseId]);
  favoritesApi.addFavorite(exerciseId).catch(() => {});
}

export function useFavorite(exerciseId: string | null) {
  const [favorited, setFavorited] = useState(false);
  const addFavoriteMutation = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  useEffect(() => {
    if (exerciseId === null) return;
    setFavorited(readFavoriteIds().includes(exerciseId));
  }, [exerciseId]);

  const toggle = useCallback(() => {
    if (exerciseId === null) return;

    const next = !favorited;
    setFavorited(next);

    const local = readFavoriteIds();
    const updated = next
      ? [...new Set([...local, exerciseId])]
      : local.filter((id) => id !== exerciseId);
    writeFavoriteIds(updated);

    const mutation = next ? addFavoriteMutation : removeFavorite;
    mutation.mutate(exerciseId, {
      onError: () => {
        // Roll the optimistic toggle back if the server rejected it.
        setFavorited(!next);
        writeFavoriteIds(local);
      },
    });
  }, [exerciseId, favorited, addFavoriteMutation, removeFavorite]);

  return {
    favorited,
    toggle,
    pending: addFavoriteMutation.isPending || removeFavorite.isPending,
  };
}
