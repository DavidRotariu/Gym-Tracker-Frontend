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

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * The API exposes POST/DELETE /favorites but no GET, so there is no way to
 * read the current favourites back. We still write through to the server and
 * mirror the state locally so the toggle can render. Drop the mirror once a
 * GET /favorites endpoint exists.
 */
export function useFavorite(exerciseId: string | null) {
  const [favorited, setFavorited] = useState(false);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  useEffect(() => {
    if (exerciseId === null) return;
    setFavorited(readLocal().includes(exerciseId));
  }, [exerciseId]);

  const toggle = useCallback(() => {
    if (exerciseId === null) return;

    const next = !favorited;
    setFavorited(next);

    const local = readLocal();
    const updated = next
      ? [...new Set([...local, exerciseId])]
      : local.filter((id) => id !== exerciseId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    const mutation = next ? addFavorite : removeFavorite;
    mutation.mutate(exerciseId, {
      onError: () => {
        // Roll the optimistic toggle back if the server rejected it.
        setFavorited(!next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
      },
    });
  }, [exerciseId, favorited, addFavorite, removeFavorite]);

  return {
    favorited,
    toggle,
    pending: addFavorite.isPending || removeFavorite.isPending,
  };
}
