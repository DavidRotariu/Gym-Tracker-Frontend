"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { RestTimer } from "@/components/workout/RestTimer";
import { SupersetGroup } from "@/components/workout/SupersetGroup";
import { WorkoutSummary } from "@/components/workout/WorkoutSummary";
import { useExercises } from "@/hooks/use-exercises";
import { useMuscles } from "@/hooks/use-muscles";
import { useSplit } from "@/hooks/use-splits";
import {
  useAddExercise,
  useDeleteSet,
  useLogSet,
  usePatchSet,
  useRemoveExercise,
  useRemoveSuperset,
  useSwapExercise,
} from "@/hooks/use-workout-session";
import { usePatchWorkout, useWorkout } from "@/hooks/use-workouts";
import { getLastSet } from "@/lib/api/exercises";
import { formatElapsed } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Set, WorkoutExercise, WorkoutSession } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function WorkoutSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const { data: session, isLoading } = useWorkout(sessionId);
  const { data: split } = useSplit(session?.split_id ?? null);
  const { data: exercises } = useExercises();
  const { data: muscles } = useMuscles();

  const patchWorkout = usePatchWorkout(sessionId);
  const addExercise = useAddExercise(sessionId);
  const removeExercise = useRemoveExercise(sessionId);
  const swapExercise = useSwapExercise(sessionId);
  const removeSuperset = useRemoveSuperset(sessionId);
  const logSet = useLogSet(sessionId);
  const patchSet = usePatchSet(sessionId);
  const deleteSet = useDeleteSet(sessionId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<WorkoutExercise | null>(null);
  const [restSignal, setRestSignal] = useState(0);
  const [summary, setSummary] = useState<WorkoutSession | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const exerciseNames = useMemo(
    () => new Map(exercises?.map((e) => [e.id, e.name])),
    [exercises],
  );
  const exerciseMuscle = useMemo(() => {
    const muscleNames = new Map(muscles?.map((m) => [m.id, m.name]));
    return new Map(
      exercises?.map((e) => [e.id, muscleNames.get(e.muscle_id) ?? ""]),
    );
  }, [exercises, muscles]);
  const exerciseImages = useMemo(
    () => new Map(exercises?.map((e) => [e.id, e.pic])),
    [exercises],
  );
  const exerciseMuscleId = useMemo(
    () => new Map(exercises?.map((e) => [e.id, e.muscle_id])),
    [exercises],
  );

  /** Consecutive exercises sharing a superset_group_id render as one group. */
  const groups = useMemo(() => {
    if (!session) return [];
    const ordered = [...session.exercises].sort(
      (a, b) => a.order_index - b.order_index,
    );
    const seen = new Set<number>();
    const result: WorkoutExercise[][] = [];
    for (const we of ordered) {
      if (we.superset_group_id !== null) {
        if (seen.has(we.superset_group_id)) continue;
        seen.add(we.superset_group_id);
        result.push(
          ordered.filter((e) => e.superset_group_id === we.superset_group_id),
        );
      } else {
        result.push([we]);
      }
    }
    return result;
  }, [session]);

  async function handleAddExercise(exerciseId: string) {
    if (swapTarget) {
      await swapExercise.mutateAsync({
        workoutExerciseId: swapTarget.id,
        exerciseId,
      });
      setSwapTarget(null);
      return;
    }
    await addExercise.mutateAsync({
      exerciseId,
      orderIndex: session?.exercises.length ?? 0,
    });
  }

  /**
   * New sets copy the previous set in this exercise so consecutive logging is
   * two taps; the first set of an exercise falls back to the last time this
   * exercise was trained.
   */
  async function handleAddSet(we: WorkoutExercise) {
    const previous = [...we.sets].sort((a, b) => b.set_number - a.set_number)[0];
    const seed = previous
      ? {
          weight: previous.actual_weight,
          reps: previous.actual_reps,
          rir: previous.actual_rir,
          type: previous.set_type,
        }
      : await getLastSet(we.exercise_id)
          .catch(() => null)
          .then((last) => ({
            weight: last?.actual_weight ?? null,
            reps: last?.actual_reps ?? null,
            rir: last?.actual_rir ?? null,
            type: "standard" as const,
          }));

    await logSet.mutateAsync({
      workoutExerciseId: we.id,
      input: {
        set_number: we.sets.length + 1,
        set_type: seed.type,
        target_weight: null,
        target_reps: null,
        target_rir: null,
        actual_weight: seed.weight,
        actual_reps: seed.reps,
        actual_rir: seed.rir,
        completed: false,
      },
    });
  }

  function handleChangeSet(setId: string, patch: Partial<Set>) {
    patchSet.mutate({ id: setId, patch });
    if (patch.completed === true) {
      setRestSignal((n) => n + 1);
    }
  }

  async function finish() {
    if (!session) return;
    const updated = await patchWorkout.mutateAsync({
      completed_at: new Date().toISOString(),
    });
    setSummary({
      ...session,
      completed_at: updated?.completed_at ?? new Date().toISOString(),
    });
  }

  if (isLoading || !session) {
    return (
      <div className="flex flex-col gap-3 pt-[calc(env(safe-area-inset-top)+64px)]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-card bg-fill"
          />
        ))}
      </div>
    );
  }

  const title = split?.name ?? "Ad-hoc workout";
  const hasExercises = session.exercises.length > 0;

  return (
    <>
      {/* Session bar ---------------------------------------------------- */}
      <div className="fixed inset-x-0 top-0 z-30 mx-auto w-full max-w-[480px] border-b border-separator bg-chrome pt-[env(safe-area-inset-top)] [backdrop-filter:blur(20px)]">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            onClick={() => router.push("/home")}
            aria-label="Back to home"
            className="-ml-2 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-label-secondary active:bg-fill"
          >
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
              <path
                d="M9.5 2 2.5 10l7 8"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-semibold text-label">{title}</p>
            <p className="tabular text-caption text-accent-ink">
              {formatElapsed(session.started_at, now)}
            </p>
          </div>

          <Button size="sm" onClick={finish} disabled={patchWorkout.isPending}>
            Finish
          </Button>
        </div>
      </div>

      <div className="pt-[calc(env(safe-area-inset-top)+3.5rem+1rem)]">
        {hasExercises && (
          <h2 className="mb-3 px-1 text-body font-semibold text-label">
            Exercises
          </h2>
        )}

        {/* Exercises ---------------------------------------------------- */}
        {!hasExercises ? (
          <Card flush>
            <EmptyState
              title="Nothing logged yet"
              description="Add your first exercise to start this session."
              action={
                <Button onClick={() => setPickerOpen(true)}>
                  Add exercise
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {groups.map((group) => {
                const cards = group.map((we) => (
                  <ExerciseCard
                    key={we.id}
                    workoutExercise={we}
                    name={exerciseNames.get(we.exercise_id) ?? "Exercise"}
                    muscle={exerciseMuscle.get(we.exercise_id)}
                    imageUrl={exerciseImages.get(we.exercise_id)}
                    onChangeSet={handleChangeSet}
                    onDeleteSet={(setId) => deleteSet.mutate(setId)}
                    onAddSet={() => handleAddSet(we)}
                    onRemove={() => removeExercise.mutate(we.id)}
                    onSwap={() => setSwapTarget(we)}
                    addPending={logSet.isPending}
                  />
                ));

                const groupId = group[0].superset_group_id;
                const key =
                  group.length > 1 && groupId !== null
                    ? `ss-${groupId}`
                    : String(group[0].id);

                return (
                  <motion.div
                    key={key}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  >
                    {group.length > 1 && groupId !== null ? (
                      <SupersetGroup onUngroup={() => removeSuperset.mutate(groupId)}>
                        {cards}
                      </SupersetGroup>
                    ) : (
                      cards
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <button
              onClick={() => setPickerOpen(true)}
              className={cn(
                "h-14 cursor-pointer rounded-card border border-dashed border-separator",
                "text-body font-semibold text-label-secondary",
                "active:border-accent-ink active:text-accent-ink",
              )}
            >
              Add exercise
            </button>
          </div>
        )}
      </div>

      {/* Rest timer, pinned above the safe area. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="pointer-events-auto">
          <RestTimer startSignal={restSignal} />
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen || swapTarget !== null}
        onClose={() => {
          setPickerOpen(false);
          setSwapTarget(null);
        }}
        onSelect={handleAddExercise}
        title={swapTarget ? "Swap exercise" : "Add exercise"}
        allowedMuscleIds={
          swapTarget
            ? [exerciseMuscleId.get(swapTarget.exercise_id)].filter(
                (id): id is string => id !== undefined,
              )
            : split?.muscles.map((m) => m.muscle_id)
        }
      />

      {summary && (
        <WorkoutSummary
          session={summary}
          title={title}
          exerciseNames={exerciseNames}
          onDone={() => router.replace(`/history/${sessionId}`)}
        />
      )}
    </>
  );
}
