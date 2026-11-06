"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
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
function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    // A hand-edited or corrupted value must not take the picker down.
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function readFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  return parseIds(localStorage.getItem(STORAGE_KEY));
}

// The mirror is an external store: components read it with useSyncExternalStore
// and every write goes through writeFavoriteIds, which notifies them.
const favListeners = new Set<() => void>();

function writeFavoriteIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* storage full/unavailable — favouriting still reaches the server */
  }
  favListeners.forEach((l) => l());
}

function subscribeFavorites(onChange: () => void) {
  favListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    favListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
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
  const raw = useSyncExternalStore(
    subscribeFavorites,
    () => localStorage.getItem(STORAGE_KEY),
    () => null,
  );
  const favorited = exerciseId !== null && parseIds(raw).includes(exerciseId);
  const addFavoriteMutation = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const toggle = useCallback(() => {
    if (exerciseId === null) return;

    const next = !favorited;
    const local = readFavoriteIds();
    writeFavoriteIds(
      next ? [...new Set([...local, exerciseId])] : local.filter((id) => id !== exerciseId),
    );

    const mutation = next ? addFavoriteMutation : removeFavorite;
    mutation.mutate(exerciseId, {
      // Roll the optimistic toggle back if the server rejected it.
      onError: () => writeFavoriteIds(local),
    });
  }, [exerciseId, favorited, addFavoriteMutation, removeFavorite]);

  return {
    favorited,
    toggle,
    pending: addFavoriteMutation.isPending || removeFavorite.isPending,
  };
}
