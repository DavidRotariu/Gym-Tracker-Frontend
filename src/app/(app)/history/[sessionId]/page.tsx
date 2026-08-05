"use client";

import { Card } from "@/components/ui/Card";
import { LargeTitle } from "@/components/ui/LargeTitle";
import { StatDisplay } from "@/components/ui/StatDisplay";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { SupersetGroup } from "@/components/workout/SupersetGroup";
import { useExercises } from "@/hooks/use-exercises";
import { useMuscles } from "@/hooks/use-muscles";
import { useSplit } from "@/hooks/use-splits";
import { useWorkout } from "@/hooks/use-workouts";
import {
  formatDay,
  formatDuration,
  formatTime,
  formatVolume,
  sessionStats,
} from "@/lib/format";
import type { WorkoutExercise } from "@/types";
import { useParams } from "next/navigation";
import { useMemo } from "react";

const noop = () => {};

export default function HistorySessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const { data: session, isLoading } = useWorkout(sessionId);
  const { data: split } = useSplit(session?.split_id ?? null);
  const { data: exercises } = useExercises();
  const { data: muscles } = useMuscles();

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

  const stats = useMemo(
    () => (session ? sessionStats(session) : null),
    [session],
  );

  const title = split?.name ?? "Ad-hoc workout";

  return (
    <>
      <LargeTitle
        title={isLoading || !session ? "Session" : title}
        eyebrow={
          session
            ? `${formatDay(session.started_at)} · ${formatTime(session.started_at)}`
            : undefined
        }
        back="/history"
        backLabel="History"
      />

      {isLoading || !session || !stats ? (
        <div className="flex flex-col gap-3">
          <div className="h-24 animate-pulse rounded-card bg-fill" />
          <div className="h-40 animate-pulse rounded-card bg-fill" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="flex items-center justify-between">
            <StatDisplay
              value={formatDuration(session.started_at, session.completed_at)}
              label="Duration"
            />
            <div className="h-8 w-px bg-separator" />
            <StatDisplay value={stats.completedSets} label="Sets" />
            <div className="h-8 w-px bg-separator" />
            <StatDisplay
              value={formatVolume(stats.volume)}
              unit="kg"
              label="Volume"
              highlight
            />
          </Card>

          {session.notes && (
            <Card>
              <p className="text-body text-label-secondary">{session.notes}</p>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const cards = group.map((we) => (
                <ExerciseCard
                  key={we.id}
                  workoutExercise={we}
                  name={exerciseNames.get(we.exercise_id) ?? "Exercise"}
                  muscle={exerciseMuscle.get(we.exercise_id)}
                  imageUrl={exerciseImages.get(we.exercise_id)}
                  readOnly
                  onChangeSet={noop}
                  onDeleteSet={noop}
                  onAddSet={noop}
                  onRemove={noop}
                />
              ));

              const groupId = group[0].superset_group_id;
              return group.length > 1 && groupId !== null ? (
                <SupersetGroup key={`ss-${groupId}`}>{cards}</SupersetGroup>
              ) : (
                <div key={group[0].id}>{cards}</div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
