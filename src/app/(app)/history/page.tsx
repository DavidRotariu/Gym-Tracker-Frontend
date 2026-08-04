"use client";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { useSplits } from "@/hooks/use-splits";
import { useDeleteWorkout, useWorkoutHistory } from "@/hooks/use-workouts";
import { formatDay, formatDuration, formatTime } from "@/lib/format";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { WorkoutSessionSummary } from "@/types";
import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo } from "react";

export default function HistoryPage() {
  const { data: history, isLoading } = useWorkoutHistory();
  const { data: splits } = useSplits();
  const deleteWorkout = useDeleteWorkout();

  const splitNames = useMemo(
    () => new Map(splits?.map((s) => [s.id, s.name])),
    [splits],
  );

  /** Completed sessions, newest first, bucketed by month for section headers. */
  const months = useMemo(() => {
    const completed = (history ?? [])
      .filter((s) => s.completed_at)
      .sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );

    const buckets = new Map<string, WorkoutSessionSummary[]>();
    for (const session of completed) {
      const key = new Date(session.started_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      const bucket = buckets.get(key);
      if (bucket) bucket.push(session);
      else buckets.set(key, [session]);
    }
    return [...buckets.entries()];
  }, [history]);

  const total = months.reduce((sum, [, sessions]) => sum + sessions.length, 0);

  return (
    <>
      <LargeTitle
        title="History"
        eyebrow={total > 0 ? `${total} workouts logged` : undefined}
      />

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-card bg-fill"
            />
          ))}
        </div>
      )}

      {!isLoading && total === 0 && (
        <Card flush>
          <EmptyState
            title="No workouts yet"
            description="Finish a session and it will show up here."
          />
        </Card>
      )}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6"
      >
        {months.map(([month, sessions]) => (
          <section key={month} className="flex flex-col gap-2">
            <h2 className="px-1 text-kicker text-label-tertiary uppercase">
              {month}
            </h2>

            <div className="flex flex-col gap-2">
              {sessions.map((session) => (
                <motion.div key={session.id} variants={staggerItem}>
                  <SwipeRow
                    actions={[
                      {
                        label: "Delete",
                        variant: "destructive",
                        onAction: () => deleteWorkout.mutate(session.id),
                      },
                    ]}
                  >
                    <Link
                      href={`/history/${session.id}`}
                      className="flex min-h-[72px] items-center gap-3 px-4 py-3 active:opacity-70"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-medium text-label">
                          {session.split_id
                            ? (splitNames.get(session.split_id) ?? "Workout")
                            : "Ad-hoc workout"}
                        </p>
                        <p className="text-caption text-label-secondary">
                          {formatDay(session.started_at)} ·{" "}
                          {formatTime(session.started_at)}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-caption font-semibold text-label-tertiary">
                        {formatDuration(session.started_at, session.completed_at)}
                      </span>
                    </Link>
                  </SwipeRow>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </motion.div>
    </>
  );
}
