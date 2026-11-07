"use client";

import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { useSplits } from "@/hooks/use-splits";
import { useDeleteWorkout, useWorkoutHistory } from "@/hooks/use-workouts";
import { getWorkouts } from "@/lib/api/workouts";
import { formatDay, formatDuration, formatTime } from "@/lib/format";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { WorkoutSessionSummary } from "@/types";
import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

/** The API serves history newest-first in pages; a full page means there may be older ones. */
const PAGE_SIZE = 50;

export default function HistoryPage() {
  const { data: head, isLoading, isError, refetch, isFetching } = useWorkoutHistory();
  // Older pages are fetched on demand with a `before` cursor and kept in this
  // screen's own state — the cached list everything else reads (Home's streak
  // and "Resume", the launch gate) stays the latest page only.
  const [older, setOlder] = useState<WorkoutSessionSummary[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);

  const history = useMemo(() => {
    if (!head) return head;
    const known = new Set(head.map((s) => s.id));
    return [...head, ...older.filter((s) => !known.has(s.id))];
  }, [head, older]);
  const canLoadMore = !exhausted && (head?.length ?? 0) >= PAGE_SIZE;

  async function loadOlder() {
    if (!history || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const oldest = history.reduce(
        (min, s) => (s.started_at < min ? s.started_at : min),
        history[0].started_at,
      );
      const page = await getWorkouts({ limit: PAGE_SIZE, before: oldest });
      const known = new Set(history.map((s) => s.id));
      const fresh = page.filter((s) => !known.has(s.id));
      setOlder((prev) => [...prev, ...fresh]);
      // A short page — or one with nothing new (a server that ignores the
      // cursor would otherwise hand us the same page forever) — is the end.
      if (page.length < PAGE_SIZE || fresh.length === 0) setExhausted(true);
    } catch (err) {
      setOlderError(
        err instanceof Error && err.message ? err.message : "Couldn't load older workouts.",
      );
    } finally {
      setLoadingOlder(false);
    }
  }
  const { data: splits } = useSplits();
  const deleteWorkout = useDeleteWorkout();
  // A deleted row lingers for its exit animation and can be tapped again.
  const deleting = useRef(new Set<string>());

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
        eyebrow={total > 0 ? `${total}${canLoadMore ? "+" : ""} workouts logged` : undefined}
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

      {isError && !head && (
        <Card flush>
          <EmptyState
            title="Couldn't load your history"
            description="Your workouts are safe — we just couldn't reach the server."
            action={
              <Button onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? "Retrying…" : "Try again"}
              </Button>
            }
          />
        </Card>
      )}

      {!isLoading && !isError && total === 0 && (
        <Card flush>
          <EmptyState
            title="No workouts yet"
            description="Finish a workout and it will show up here."
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
            <SectionLabel>{month}</SectionLabel>

            <div className="flex flex-col gap-2">
              {sessions.map((session) => (
                <motion.div key={session.id} variants={staggerItem}>
                  <SwipeRow
                    actions={[
                      {
                        label: "Delete",
                        variant: "destructive",
                        // A whole logged workout, gone for good — ask first.
                        onAction: () => {
                          if (
                            !deleting.current.has(session.id) &&
                            window.confirm("Delete this workout? This can't be undone.")
                          ) {
                            deleting.current.add(session.id);
                            // Failure is toasted by the mutation; the row comes back.
                            deleteWorkout.mutateAsync(session.id).then(
                              () => setOlder((prev) => prev.filter((s) => s.id !== session.id)),
                              () => {},
                            ).finally(() => deleting.current.delete(session.id));
                          }
                        },
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

      {canLoadMore && total > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          {olderError && <p role="alert" className="text-caption text-red">{olderError}</p>}
          <Button variant="secondary" onClick={loadOlder} disabled={loadingOlder}>
            {loadingOlder ? "Loading…" : olderError ? "Try again" : "Load older workouts"}
          </Button>
        </div>
      )}
    </>
  );
}
