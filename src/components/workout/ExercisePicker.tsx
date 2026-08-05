"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { Sheet } from "@/components/ui/Sheet";
import { useExercises } from "@/hooks/use-exercises";
import { useMuscles } from "@/hooks/use-muscles";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Muscle } from "@/types";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  /** Restrict to the muscles the current split calls for. */
  allowedMuscleIds?: string[];
  /** Sheet title when no muscle is picked yet. */
  title?: string;
}

const LAST_EXERCISE_KEY = "overload_last_exercise_by_muscle";

function readLastByMuscle(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LAST_EXERCISE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function rememberLast(muscleId: string, exerciseId: string) {
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
  const [activeMuscle, setActiveMuscle] = useState<Muscle | null>(null);
  const [lastByMuscle, setLastByMuscle] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setLastByMuscle(readLastByMuscle());
  }, [open]);

  useEffect(() => {
    if (!open) {
      setActiveMuscle(null);
      setQuery("");
    }
  }, [open]);

  const muscleName = useMemo(
    () => new Map(muscles?.map((m) => [m.id, m.name])),
    [muscles],
  );

  /** Typing searches across every exercise, muscle step or not — clear the
   *  query to fall back to the muscle-first browse flow. */
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (exercises ?? []).filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, query]);

  /** Every muscle is browsable; the split's own muscles just float to the
   *  top and get an accent highlight, instead of hiding the rest. */
  const visibleMuscles = useMemo(() => {
    if (!muscles) return [];
    if (!allowedMuscleIds) return muscles;
    const allowed = new Set(allowedMuscleIds);
    return [...muscles].sort((a, b) => {
      const aIn = allowed.has(a.id) ? 0 : 1;
      const bIn = allowed.has(b.id) ? 0 : 1;
      return aIn - bIn;
    });
  }, [muscles, allowedMuscleIds]);

  const exercisesByMuscle = useMemo(() => {
    const map = new Map<string, typeof exercises>();
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

  function choose(exercise: { id: string; muscle_id: string }) {
    rememberLast(exercise.muscle_id, exercise.id);
    onSelect(exercise.id);
    onClose();
  }

  function renderRow(
    exercise: NonNullable<typeof exercises>[number],
    isLast: boolean,
    subtitle?: string,
  ) {
    return (
      <button
        key={exercise.id}
        onClick={() => choose(exercise)}
        className={cn(
          "flex min-h-14 cursor-pointer items-center gap-3 rounded-control",
          "bg-background-secondary py-2 pr-4 pl-2 text-left active:opacity-70",
          isLast && "ring-1 ring-inset ring-accent-ink/60",
        )}
      >
        <MediaThumb
          src={exercise.pic}
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
          {subtitle && (
            <span className="block truncate text-caption text-label-tertiary">
              {subtitle}
            </span>
          )}
        </span>
        {isLast && (
          <span className="shrink-0 rounded-pill bg-accent-muted px-2 py-1 text-tab font-bold text-accent-ink uppercase">
            Last time
          </span>
        )}
      </button>
    );
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
      <div className="pb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          className="h-11 w-full rounded-control bg-fill px-4 text-body text-label placeholder:text-label-tertiary focus:outline-2 focus:outline-offset-0 focus:outline-blue"
        />
      </div>

      {query.trim() ? (
        <div className="flex flex-col gap-2 pb-2">
          {searchResults.length === 0 ? (
            <EmptyState
              title="No matches"
              description={`Nothing found for "${query.trim()}".`}
            />
          ) : (
            searchResults.map((exercise) =>
              renderRow(
                exercise,
                lastByMuscle[exercise.muscle_id] === exercise.id,
                muscleName.get(exercise.muscle_id),
              ),
            )
          )}
        </div>
      ) : !activeMuscle ? (
        <div className="flex flex-col gap-4 pb-2">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-card bg-fill" />
              ))}
            </div>
          ) : visibleMuscles.length === 0 ? (
            <EmptyState title="No muscles" description="No muscle groups to pick from." />
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-3"
            >
              {visibleMuscles.map((m) => {
                const count = exercisesByMuscle.get(m.id)?.length ?? 0;
                const inSplit = allowedMuscleIds?.includes(m.id) ?? false;
                return (
                  <motion.button
                    key={m.id}
                    variants={staggerItem}
                    type="button"
                    onClick={() => setActiveMuscle(m)}
                    whileTap={{ scale: 0.96 }}
                    className={cn(
                      "relative flex h-24 cursor-pointer flex-col justify-end overflow-hidden rounded-card bg-background-secondary p-3 text-left",
                      "active:opacity-70",
                      // A thin *inset* ring (box-shadow) instead of an
                      // outline — outline draws outside the box and doesn't
                      // clip to the radius the same way everywhere, so it
                      // reads as a hard rectangle poking past the rounded
                      // corners. ring-inset always follows the radius.
                      inSplit && "ring-1 ring-inset ring-accent-ink/60",
                    )}
                  >
                    <MediaThumb
                      src={m.pic}
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
                    {inSplit && (
                      <span className="absolute top-2 right-2 rounded-pill bg-accent px-2 py-1 text-tab font-bold text-accent-foreground uppercase">
                        In split
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
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

          {activeExercises.map((exercise) =>
            renderRow(exercise, lastByMuscle[activeMuscle.id] === exercise.id),
          )}
        </div>
      )}
    </Sheet>
  );
}
