"use client";

import { ApiRequestError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Gauge } from "@/components/ui/Gauge";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { Sheet } from "@/components/ui/Sheet";
import { SetTypeBadge } from "@/components/ui/SetTypeBadge";
import { StatDisplay } from "@/components/ui/StatDisplay";
import { TextField } from "@/components/ui/TextField";
import { useExerciseHistory, useExercises, useUpdateExercise } from "@/hooks/use-exercises";
import { useFavorite } from "@/hooks/use-favorites";
import { useMuscles } from "@/hooks/use-muscles";
import { formatDay, formatVolume } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Exercise, ExerciseType, Muscle } from "@/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function ExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const exerciseId = params.id;

  const { data: exercises } = useExercises();
  const { data: muscles } = useMuscles();
  const { data: history, isLoading } = useExerciseHistory(exerciseId);
  const { favorited, toggle, pending } = useFavorite(exerciseId);
  const [editOpen, setEditOpen] = useState(false);

  const exercise = useMemo(
    () => exercises?.find((e) => e.id === exerciseId),
    [exercises, exerciseId],
  );
  const muscleName = muscles?.find((m) => m.id === exercise?.muscle_id)?.name;

  const stats = useMemo(() => {
    if (!history?.length) return null;
    let best = 0;
    let bestReps = 0;
    let totalVolume = 0;
    let totalSets = 0;

    for (const entry of history) {
      for (const set of entry.sets) {
        const weight = set.actual_weight ?? 0;
        const reps = set.actual_reps ?? 0;
        totalSets += 1;
        totalVolume += weight * reps;
        if (weight > best) {
          best = weight;
          bestReps = reps;
        }
      }
    }
    return { best, bestReps, totalVolume, totalSets, sessions: history.length };
  }, [history]);

  return (
    <>
      <LargeTitle
        title={exercise?.name ?? "Exercise"}
        eyebrow={muscleName}
        back
        action={
          exercise ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Edit exercise"
              className="flex size-9 cursor-pointer items-center justify-center rounded-pill text-label-secondary active:bg-fill"
            >
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <path
                  d="M13.5 2.5 17 6 6.5 16.5 2.5 17.5 3.5 13.5 14 3z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : undefined
        }
      />

      <div className="relative mb-4">
        <MediaThumb
          src={exercise?.pic}
          alt={exercise ? `${exercise.name} demonstration` : ""}
          fallback={
            <span className="text-stat text-label-tertiary">
              {(exercise?.name ?? "?").slice(0, 1)}
            </span>
          }
          className="h-48 w-full rounded-card"
        />

        <button
          onClick={toggle}
          disabled={pending}
          aria-pressed={favorited}
          aria-label={favorited ? "Remove from favourites" : "Add to favourites"}
          className={cn(
            "absolute top-3 right-3 flex size-11 cursor-pointer items-center justify-center rounded-pill",
            "bg-black/40 backdrop-blur-md transition-colors duration-150",
            "active:bg-black/55 disabled:opacity-40",
            favorited ? "text-accent-ink" : "text-white",
          )}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 4.6c1.6-2 4-2.2 5.7-.8 1.8 1.5 2 4.2.4 6L12 16.5 5.9 9.8c-1.6-1.8-1.4-4.5.4-6 1.7-1.4 4.1-1.2 5.7.8z"
              fill={favorited ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <div className="h-24 animate-pulse rounded-card bg-fill" />
          <div className="h-32 animate-pulse rounded-card bg-fill" />
        </div>
      )}

      {!isLoading && !stats && (
        <Card flush>
          <EmptyState
            title="No logs yet"
            description="Log this exercise in a workout and its history will build up here."
          />
        </Card>
      )}

      {exercise && exercise.secondary_muscles.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {exercise.secondary_muscles.map((m) => (
            <span
              key={m.id}
              className="rounded-pill bg-fill px-3 py-1 text-caption font-medium text-label-secondary"
            >
              {m.name}
            </span>
          ))}
        </div>
      )}

      {stats && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-kicker text-accent-ink uppercase">
                  Personal record
                </p>
                <p className="tabular text-stat text-label">
                  {stats.best}
                  <span className="text-body text-label-tertiary"> kg</span>
                </p>
              </div>
              {stats.bestReps > 0 && (
                <p className="tabular pb-2 text-caption text-label-secondary">
                  × {stats.bestReps} reps
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-separator pt-3">
              <StatDisplay value={stats.sessions} label="Sessions" />
              <div className="h-8 w-px bg-separator" />
              <StatDisplay value={stats.totalSets} label="Sets" />
              <div className="h-8 w-px bg-separator" />
              <StatDisplay
                value={formatVolume(stats.totalVolume)}
                unit="kg"
                label="Volume"
              />
            </div>
          </Card>

          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-body font-semibold text-label">History</h2>

            {history?.map((entry) => (
              <Card key={entry.workout_session_id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-caption font-semibold text-label-secondary">
                    {formatDay(entry.date)}
                  </p>
                  <Link
                    href={`/history/${entry.workout_session_id}`}
                    className="text-caption font-semibold text-accent-ink active:opacity-60"
                  >
                    Session
                  </Link>
                </div>

                <ul className="flex flex-col gap-2">
                  {entry.sets.map((set) => (
                    <li
                      key={set.set_number}
                      className="flex flex-col gap-2 rounded-control bg-fill p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="tabular w-5 shrink-0 text-center text-caption font-bold text-label-tertiary">
                          {set.set_number}
                        </span>
                        <SetTypeBadge type={set.set_type} short />
                        <span className="tabular flex-1 text-body font-medium text-label">
                          {set.actual_weight ?? 0} kg × {set.actual_reps ?? 0}
                        </span>
                        <span className="tabular shrink-0 text-caption text-label-tertiary">
                          {set.actual_rir !== null
                            ? `@${set.actual_rir === 5 ? "5+" : set.actual_rir} RIR`
                            : "—"}
                        </span>
                      </div>
                      <Gauge rir={set.actual_rir} />
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </section>
        </div>
      )}

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit exercise">
        {exercise && (
          <ExerciseEditForm
            exercise={exercise}
            muscles={muscles ?? []}
            onSaved={() => setEditOpen(false)}
          />
        )}
      </Sheet>
    </>
  );
}

/**
 * Edits the shared catalog entry, not a per-user copy — fine for a two-person
 * app, but worth remembering if this ever grows past that.
 */
function ExerciseEditForm({
  exercise,
  muscles,
  onSaved,
}: {
  exercise: Exercise;
  muscles: Muscle[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(exercise.name);
  const [muscleId, setMuscleId] = useState(exercise.muscle_id);
  const [exerciseType, setExerciseType] = useState<ExerciseType>(exercise.exercise_type);
  const [secondaryMuscleIds, setSecondaryMuscleIds] = useState(
    new Set(exercise.secondary_muscles.map((m) => m.id)),
  );
  const [equipment, setEquipment] = useState(exercise.equipment ?? "");
  const [tips, setTips] = useState(exercise.tips ?? "");
  const [error, setError] = useState<string | null>(null);
  const updateExercise = useUpdateExercise();

  function toggleSecondaryMuscle(id: string) {
    setSecondaryMuscleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this exercise a name.");
      return;
    }
    setError(null);
    try {
      await updateExercise.mutateAsync({
        id: exercise.id,
        input: {
          name: name.trim(),
          muscle_id: muscleId,
          exercise_type: exerciseType,
          equipment: equipment.trim() || null,
          tips: tips.trim() || null,
          secondary_muscles: [...secondaryMuscleIds],
        },
      });
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't save changes. Try again.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-2">
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
      />

      <div className="flex flex-col gap-2">
        <label className="text-caption font-medium text-label-secondary">Muscle</label>
        <select
          value={muscleId}
          onChange={(e) => setMuscleId(e.target.value)}
          className="h-12 rounded-control bg-fill px-4 text-body text-label focus:outline-2 focus:outline-offset-0 focus:outline-blue"
        >
          {muscles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-caption font-medium text-label-secondary">Type</label>
        <select
          value={exerciseType}
          onChange={(e) => setExerciseType(e.target.value as ExerciseType)}
          className="h-12 rounded-control bg-fill px-4 text-body text-label focus:outline-2 focus:outline-offset-0 focus:outline-blue"
        >
          <option value="weighted">Weighted</option>
          <option value="body_weight">Body weight</option>
          <option value="negative">Negative</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-caption font-medium text-label-secondary">
          Secondary muscles
        </label>
        <div className="flex flex-wrap gap-2">
          {muscles
            .filter((m) => m.id !== muscleId)
            .map((m) => {
              const selected = secondaryMuscleIds.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSecondaryMuscle(m.id)}
                  className={cn(
                    "cursor-pointer rounded-pill px-3 py-1.5 text-caption font-medium transition-colors",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "bg-fill text-label-secondary",
                  )}
                >
                  {m.name}
                </button>
              );
            })}
        </div>
      </div>

      <TextField
        label="Equipment"
        value={equipment}
        onChange={(e) => setEquipment(e.target.value)}
        placeholder="Barbell, bench…"
        autoComplete="off"
      />

      <div className="flex flex-col gap-2">
        <label className="text-caption font-medium text-label-secondary">Tips</label>
        <textarea
          value={tips}
          onChange={(e) => setTips(e.target.value)}
          rows={4}
          placeholder="Form cues, setup notes…"
          className="rounded-control bg-fill px-4 py-3 text-body text-label placeholder:text-label-tertiary focus:outline-2 focus:outline-offset-0 focus:outline-blue"
        />
      </div>

      {error && <p className="text-caption text-red">{error}</p>}

      <Button type="submit" size="lg" block disabled={updateExercise.isPending}>
        {updateExercise.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
