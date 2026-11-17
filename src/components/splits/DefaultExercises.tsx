"use client";

import { Button } from "@/components/ui/Button";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { useExercises } from "@/hooks/use-exercises";
import { useState } from "react";

interface DefaultExercisesProps {
  ids: string[];
  onChange: (ids: string[]) => void;
}

/** The exact exercises a workout from this split starts with, in order. */
export function DefaultExercises({ ids, onChange }: DefaultExercisesProps) {
  const { data: exercises } = useExercises();
  const [pickerOpen, setPickerOpen] = useState(false);
  const nameOf = (id: string) =>
    exercises?.find((e) => e.id === id)?.name ?? "…";

  function move(from: number, to: number) {
    const next = [...ids];
    next.splice(to, 0, ...next.splice(from, 1));
    onChange(next);
  }

  const iconButton =
    "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-label-secondary active:opacity-60 disabled:cursor-default disabled:opacity-25";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-caption font-medium text-label-secondary">
          Default exercises
        </span>
        <span className="text-caption text-label-tertiary">
          {ids.length ? "Used instead of the allocation" : "Optional"}
        </span>
      </div>

      <div className="overflow-hidden rounded-card bg-background-secondary">
        {ids.length > 0 && (
          <ol className="divide-y divide-separator">
            {ids.map((id, i) => (
              <li key={id} className="flex items-center gap-1 py-1 pl-4 pr-1">
                <span className="tabular w-6 shrink-0 text-caption text-label-tertiary">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-body text-label">
                  {nameOf(id)}
                </span>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`Move ${nameOf(id)} up`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={`Move ${nameOf(id)} down`}
                  disabled={i === ids.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={iconButton + " text-red"}
                  aria-label={`Remove ${nameOf(id)}`}
                  onClick={() => onChange(ids.filter((x) => x !== id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
        <Button
          type="button"
          variant="ghost"
          block
          onClick={() => setPickerOpen(true)}
        >
          Add exercise
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => {
          if (!ids.includes(id)) onChange([...ids, id]);
        }}
        title="Add default exercise"
      />
    </div>
  );
}
