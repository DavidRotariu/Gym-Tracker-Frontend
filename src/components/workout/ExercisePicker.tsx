"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { Sheet } from "@/components/ui/Sheet";
import { useExercises } from "@/hooks/use-exercises";
import { useMuscles } from "@/hooks/use-muscles";
import { cn } from "@/lib/utils";
import type { Muscle } from "@/types";
import { useEffect, useMemo, useState } from "react";

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseId: number) => void;
  /** Restrict to the muscles the current split calls for. */
  allowedMuscleIds?: number[];
  /** Sheet title when no muscle is picked yet. */
  title?: string;
}

const LAST_EXERCISE_KEY = "overload_last_exercise_by_muscle";

function readLastByMuscle(): Record<number, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LAST_EXERCISE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function rememberLast(muscleId: number, exerciseId: number) {
  const current = readLastByMuscle();
  current[muscleId] = exerciseId;
  localStorage.setItem(LAST_EXERCISE_KEY, JSON.stringify(current));
}

/**
 * Two steps: pick a muscle card, then pick an exercise for it — the one you
 * used last time for that muscle floats to the top, pre-selected in
 * everything but name, so continuing a routine is a single tap.
 */
export function ExercisePicker({
  open,
  onClose,
  onSelect,
  allowedMuscleIds,
  title = "Add exercise",
}: ExercisePickerProps) {
  const { data: muscles } = useMuscles();
  const { data: exercises, isLoading } = useExercises();
  const [showAll, setShowAll] = useState(false);
  const [activeMuscle, setActiveMuscle] = useState<Muscle | null>(null);
  const [lastByMuscle, setLastByMuscle] = useState<Record<number, number>>({});

  useEffect(() => {
    if (open) setLastByMuscle(readLastByMuscle());
  }, [open]);

  useEffect(() => {
    if (!open) {
      setActiveMuscle(null);
      setShowAll(false);
    }
  }, [open]);

  const restricted = allowedMuscleIds !== undefined && !showAll;

  const visibleMuscles = useMemo(() => {
    if (!muscles) return [];
    if (!restricted) return muscles;
    return muscles.filter((m) => allowedMuscleIds!.includes(m.id));
  }, [muscles, restricted, allowedMuscleIds]);

  const exercisesByMuscle = useMemo(() => {
    const map = new Map<number, typeof exercises>();
    for (const e of exercises ?? []) {
      const list = map.get(e.muscle_id) ?? [];
      list.push(e);
      map.set(e.muscle_id, list);
    }
    return map;
  }, [exercises]);

  const activeExercises = useMemo(() => {
    if (!activeMuscle) return [];
    const list = [...(exercisesByMuscle.get(activeMuscle.id) ?? [])];
    const lastId = lastByMuscle[activeMuscle.id];
    if (lastId === undefined) return list;
    list.sort((a, b) => (a.id === lastId ? -1 : b.id === lastId ? 1 : 0));
    return list;
  }, [activeMuscle, exercisesByMuscle, lastByMuscle]);

  function choose(exercise: { id: number; muscle_id: number }) {
    rememberLast(exercise.muscle_id, exercise.id);
    onSelect(exercise.id);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={activeMuscle ? activeMuscle.name : title}
      action={
        activeMuscle ? (
          <button
            type="button"
            onClick={() => setActiveMuscle(null)}
            className="min-h-11 cursor-pointer px-2 text-body font-semibold text-blue active:opacity-60"
          >
            Muscles
          </button>
        ) : undefined
      }
    >
      {!activeMuscle ? (
        <div className="flex flex-col gap-4 pb-2">
          {allowedMuscleIds !== undefined && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="min-h-11 cursor-pointer self-start text-body font-semibold text-blue active:opacity-60"
            >
              {showAll ? "Only this split's muscles" : "Show all muscles"}
            </button>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-card bg-fill" />
              ))}
            </div>
          ) : visibleMuscles.length === 0 ? (
            <EmptyState title="No muscles" description="No muscle groups to pick from." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visibleMuscles.map((m) => {
                const count = exercisesByMuscle.get(m.id)?.length ?? 0;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveMuscle(m)}
                    className={cn(
                      "relative flex h-24 cursor-pointer flex-col justify-end overflow-hidden rounded-card bg-background-secondary p-3 text-left",
                      "active:opacity-70",
                    )}
                  >
                    <MediaThumb
                      src={m.image_url}
                      alt=""
                      fallback={
                        <span className="text-stat-sm font-bold text-label-tertiary">
                          {m.name.slice(0, 1)}
                        </span>
                      }
                      className="absolute inset-0 size-full"
                    />
                    <div className="relative bg-gradient-to-t from-black/55 via-transparent to-transparent p-2 -m-2 pt-6">
                      <p className="text-body font-semibold text-label">{m.name}</p>
                      <p className="text-tab text-label-tertiary">
                        {count} exercise{count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 pb-2">
          {activeExercises.length === 0 && (
            <EmptyState
              title="No exercises"
              description="Nothing catalogued for this muscle yet."
            />
          )}

          {activeExercises.map((exercise) => {
            const isLast = lastByMuscle[activeMuscle.id] === exercise.id;
            return (
              <button
                key={exercise.id}
                onClick={() => choose(exercise)}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-control",
                  "bg-background-secondary py-2 pr-4 pl-2 text-left active:opacity-70",
                  isLast && "outline-2 outline-accent-ink",
                )}
              >
                <MediaThumb
                  src={exercise.image_url}
                  alt=""
                  fallback={
                    <span className="text-caption font-bold text-label-tertiary">
                      {exercise.name.slice(0, 1)}
                    </span>
                  }
                  className="size-10 shrink-0 rounded-control"
                />
                <span className="min-w-0 flex-1 truncate text-body font-medium text-label">
                  {exercise.name}
                </span>
                {isLast && (
                  <span className="shrink-0 rounded-pill bg-accent-muted px-2 py-1 text-tab font-bold text-accent-ink uppercase">
                    Last time
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
