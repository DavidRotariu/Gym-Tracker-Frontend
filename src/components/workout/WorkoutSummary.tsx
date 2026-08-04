"use client";

import { StatDisplay } from "@/components/ui/StatDisplay";
import { getExerciseHistory } from "@/lib/api/exercises";
import {
  formatDuration,
  formatVolume,
  sessionStats,
  sessionTopSets,
} from "@/lib/format";
import type { WorkoutSession } from "@/types";
import { useQueries } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

interface WorkoutSummaryProps {
  session: WorkoutSession;
  title: string;
  exerciseNames: Map<number, string>;
  onDone: () => void;
}

interface PersonalRecord {
  exerciseId: number;
  weight: number;
  reps: number;
  previous: number;
}

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * The campaign moment. Full-bleed volt with black ink — identical in light and
 * dark, because the celebration shouldn't be themed. This is the only screen
 * that departs from the iOS shell.
 */
export function WorkoutSummary({
  session,
  title,
  exerciseNames,
  onDone,
}: WorkoutSummaryProps) {
  const reduceMotion = useReducedMotion();
  const stats = useMemo(() => sessionStats(session), [session]);
  const topSets = useMemo(() => sessionTopSets(session), [session]);

  const exerciseIds = useMemo(
    () => [...new Set(session.exercises.map((e) => e.exercise_id))],
    [session],
  );

  const historyQueries = useQueries({
    queries: exerciseIds.map((id) => ({
      queryKey: ["exercise-history", id],
      queryFn: () => getExerciseHistory(id, { limit: 50 }),
      staleTime: 60_000,
    })),
  });

  const personalRecords = useMemo<PersonalRecord[]>(() => {
    const records: PersonalRecord[] = [];

    exerciseIds.forEach((exerciseId, index) => {
      const today = topSets.get(exerciseId);
      const entries = historyQueries[index]?.data;
      if (!today || !entries) return;

      let previousBest = 0;
      let hasPrior = false;
      for (const entry of entries) {
        if (entry.workout_session_id === session.id) continue;
        for (const set of entry.sets) {
          if (set.actual_weight === null) continue;
          hasPrior = true;
          previousBest = Math.max(previousBest, set.actual_weight);
        }
      }

      if (hasPrior && today.weight > previousBest) {
        records.push({
          exerciseId,
          weight: today.weight,
          reps: today.reps,
          previous: previousBest,
        });
      }
    });

    return records;
  }, [exerciseIds, topSets, historyQueries, session.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-accent"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4, ease: EASE }}
        >
          <p className="text-kicker text-accent-foreground/70 uppercase">
            Workout complete
          </p>
          <h1 className="mt-2 font-display text-stat-sm text-accent-foreground uppercase">
            {title}
          </h1>
        </motion.div>

        {/* Hero number */}
        <motion.div
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.86, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={
            reduceMotion
              ? { duration: 0.2 }
              : { type: "spring", damping: 16, stiffness: 220, delay: 0.16 }
          }
          className="mt-10"
        >
          <StatDisplay
            size="hero"
            tone="onAccent"
            value={formatVolume(stats.volume)}
            unit="kg"
            label="Total volume"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: EASE }}
          className="mt-10 flex items-start justify-between border-t border-accent-foreground/20 pt-6"
        >
          <StatDisplay
            tone="onAccent"
            value={formatDuration(session.started_at, session.completed_at)}
            label="Duration"
          />
          <StatDisplay
            tone="onAccent"
            value={stats.completedSets}
            label="Sets"
          />
          <StatDisplay
            tone="onAccent"
            value={stats.exerciseCount}
            label="Exercises"
          />
        </motion.div>

        {personalRecords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.44, duration: 0.4, ease: EASE }}
            className="mt-8 flex flex-col gap-3"
          >
            <p className="text-kicker text-accent-foreground/70 uppercase">
              {personalRecords.length === 1
                ? "New PR"
                : `${personalRecords.length} new PRs`}
            </p>
            {personalRecords.map((pr) => (
              <div
                key={pr.exerciseId}
                className="flex items-center justify-between gap-4 rounded-card bg-accent-foreground p-4 shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-white">
                    {exerciseNames.get(pr.exerciseId) ?? "Exercise"}
                  </p>
                  <p className="text-caption text-white/60">
                    Previous best {pr.previous} kg
                  </p>
                </div>
                <p className="tabular shrink-0 font-display text-stat-sm text-accent">
                  {pr.weight}
                  <span className="text-caption"> kg</span>
                </p>
              </div>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-auto pt-10"
        >
          <button
            onClick={onDone}
            className="h-14 w-full cursor-pointer rounded-button bg-accent-foreground text-body font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
          >
            Done
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
