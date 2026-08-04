"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { MuscleChips } from "@/components/ui/MuscleChips";
import { Sheet } from "@/components/ui/Sheet";
import { useMuscles } from "@/hooks/use-muscles";
import { useSplits } from "@/hooks/use-splits";
import { useStartWorkout, useWorkoutHistory } from "@/hooks/use-workouts";
import {
  currentStreak,
  formatDay,
  formatDuration,
  suggestSplit,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const { data: splits, isLoading: splitsLoading } = useSplits();
  const { data: history } = useWorkoutHistory();
  const { data: muscles } = useMuscles();
  const startWorkout = useStartWorkout();
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [],
  );

  const muscleLookup = useMemo(
    () => new Map(muscles?.map((m) => [m.id, m.name])),
    [muscles],
  );
  const splitNames = useMemo(
    () => new Map(splits?.map((s) => [s.id, s.name])),
    [splits],
  );

  const inProgress = history?.find((s) => !s.completed_at);
  const completed = useMemo(
    () => history?.filter((s) => s.completed_at) ?? [],
    [history],
  );
  const suggested = useMemo(
    () => suggestSplit(splits, history),
    [splits, history],
  );

  const streak = useMemo(() => currentStreak(history), [history]);

  /** The muscle this split calls for most — the card's hero image. */
  const suggestedImage = useMemo(() => {
    if (!suggested?.muscles.length) return null;
    const primary = [...suggested.muscles].sort(
      (a, b) => b.nr_of_exercises - a.nr_of_exercises,
    )[0];
    return muscles?.find((m) => m.id === primary.muscle_id)?.image_url ?? null;
  }, [suggested, muscles]);

  async function start(splitId: number | null) {
    const session = await startWorkout.mutateAsync(splitId);
    setPickerOpen(false);
    router.push(`/workout/${session.id}`);
  }

  return (
    <>
      <LargeTitle
        title="Today"
        eyebrow={today}
        action={<StreakBadge streak={streak} />}
      />

      <div className="flex flex-col gap-8">
        {/* Up next -------------------------------------------------------- */}
        {suggested ? (
          <section className="flex flex-col gap-3">
            <p className="text-kicker text-label-tertiary uppercase">Up next</p>
            <Card flush className="relative h-64 overflow-hidden">
              <MediaThumb
                src={suggestedImage}
                alt=""
                static
                fallback={<div className="size-full bg-fill" />}
                className="absolute inset-0 size-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

              <button
                onClick={() => start(suggested.id)}
                disabled={startWorkout.isPending}
                aria-label={`Start ${suggested.name}`}
                className={cn(
                  "absolute top-4 right-4 flex size-12 cursor-pointer items-center justify-center rounded-pill",
                  "bg-accent text-accent-foreground",
                  "transition-transform duration-150 active:scale-95 disabled:opacity-40",
                )}
              >
                <svg width="17" height="19" viewBox="0 0 18 20" fill="none">
                  <path d="M3 2.5 15.5 10 3 17.5z" fill="currentColor" />
                </svg>
              </button>

              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4">
                <h2 className="min-w-0 truncate font-stat text-stat-sm text-white">
                  {suggested.name}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {suggested.muscles.map((m) => (
                    <li
                      key={m.muscle_id}
                      className="rounded-pill bg-white/15 px-3 py-1 text-caption font-medium text-white backdrop-blur-sm"
                    >
                      {muscleLookup.get(m.muscle_id) ?? `#${m.muscle_id}`}
                      <span className="tabular ml-1 text-white/70">
                        ×{m.nr_of_exercises}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </section>
        ) : splitsLoading ? (
          <div className="h-32 animate-pulse rounded-card bg-fill" />
        ) : (
          <Card flush>
            <EmptyState
              title="No splits yet"
              description="Create a split to get a suggested session each time you train."
              action={
                <Button onClick={() => router.push("/splits/new")}>
                  Create a split
                </Button>
              }
            />
          </Card>
        )}

        {/* Recent --------------------------------------------------------- */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-kicker text-label-tertiary uppercase">Recent</h2>
            {completed.length > 0 && (
              <Link
                href="/history"
                className="text-caption font-semibold text-blue"
              >
                See all
              </Link>
            )}
          </div>

          {completed.length === 0 ? (
            <Card flush>
              <EmptyState
                title="Nothing logged yet"
                description="Your finished sessions will show up here."
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {completed.slice(0, 3).map((session) => (
                <Link key={session.id} href={`/history/${session.id}`}>
                  <Card className="flex min-h-11 items-center justify-between gap-4 active:opacity-70">
                    <div className="min-w-0">
                      <p className="truncate text-body font-medium text-label">
                        {session.split_id
                          ? (splitNames.get(session.split_id) ?? "Workout")
                          : "Ad-hoc workout"}
                      </p>
                      <p className="text-subhead text-label-secondary">
                        {formatDay(session.started_at)} ·{" "}
                        {formatDuration(session.started_at, session.completed_at)}
                      </p>
                    </div>
                    <Chevron />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Primary CTA — accent color, pinned in the thumb zone above the tab bar. */}
      <div
        className={cn(
          "fixed inset-x-0 z-30 mx-auto w-full max-w-[480px] px-4",
          "bottom-[calc(env(safe-area-inset-bottom)+64px)]",
          "pointer-events-none pt-8",
          "bg-gradient-to-t from-background via-background to-transparent",
        )}
      >
        <Button
          size="lg"
          block
          className="pointer-events-auto"
          disabled={startWorkout.isPending}
          onClick={() =>
            inProgress
              ? router.push(`/workout/${inProgress.id}`)
              : setPickerOpen(true)
          }
        >
          {inProgress ? "Resume workout" : "Start workout"}
        </Button>
      </div>

      <StartSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        splits={splits}
        suggestedId={suggested?.id ?? null}
        muscleLookup={muscleLookup}
        onStart={start}
        pending={startWorkout.isPending}
      />
    </>
  );
}

function StartSheet({
  open,
  onClose,
  splits,
  suggestedId,
  muscleLookup,
  onStart,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  splits: ReturnType<typeof useSplits>["data"];
  suggestedId: number | null;
  muscleLookup: Map<number, string>;
  onStart: (splitId: number | null) => void;
  pending: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Start workout">
      <div className="flex flex-col gap-2">
        {splits?.map((split) => (
          <button
            key={split.id}
            disabled={pending}
            onClick={() => onStart(split.id)}
            className={cn(
              "flex w-full cursor-pointer flex-col gap-3 rounded-card bg-background-secondary p-4 text-left",
              "active:opacity-70 disabled:opacity-40",
              split.id === suggestedId && "outline-2 outline-accent-ink",
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-body font-semibold text-label">
                {split.name}
              </span>
              {split.id === suggestedId && (
                <span className="rounded-pill bg-accent px-2 py-1 text-tab font-bold text-accent-foreground uppercase">
                  Suggested
                </span>
              )}
            </div>
            <MuscleChips muscles={split.muscles} lookup={muscleLookup} />
          </button>
        ))}

        <button
          disabled={pending}
          onClick={() => onStart(null)}
          className={cn(
            "mt-2 flex min-h-14 w-full cursor-pointer items-center justify-center rounded-card",
            "bg-fill text-body font-semibold text-label",
            "active:opacity-70 disabled:opacity-40",
          )}
        >
          Empty workout
        </button>
      </div>
    </Sheet>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak <= 0) return null;

  return (
    <div
      className="flex items-center gap-1 rounded-pill bg-fill py-1 pr-3 pl-2"
      aria-label={`${streak} day streak`}
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 1.5c.6 2.4-.4 3.9-1.7 5.3C7 8 5.8 9.3 5.8 11.4a4.2 4.2 0 0 0 8.4 0c0-1.3-.5-2.2-1-3 .9.3 2.3 1.5 2.3 4a5.5 5.5 0 1 1-11 0c0-4.6 3.2-6.6 5.5-10.9Z"
          fill="var(--color-orange)"
        />
      </svg>
      <span className="tabular text-caption font-bold text-label">
        {streak}
      </span>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      width="8"
      height="14"
      viewBox="0 0 8 14"
      fill="none"
      className="shrink-0 text-label-tertiary"
      aria-hidden
    >
      <path
        d="M1.5 1 6.5 7l-5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
