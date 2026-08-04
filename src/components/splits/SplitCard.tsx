"use client";

import { MuscleChips } from "@/components/ui/MuscleChips";
import { cn } from "@/lib/utils";
import type { Muscle, Split } from "@/types";

interface SplitCardProps {
  split: Split;
  muscles?: Muscle[];
  onStart: () => void;
  pending?: boolean;
}

/**
 * Row content only — the list wraps this in a SwipeRow, which supplies the
 * card surface and the edit/delete actions.
 */
export function SplitCard({ split, muscles, onStart, pending }: SplitCardProps) {
  const totalExercises = split.muscles.reduce(
    (sum, m) => sum + m.nr_of_exercises,
    0,
  );

  return (
    <div className="flex items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-body font-semibold text-label">
          {split.name}
        </h3>
        <p className="tabular text-subhead text-label-secondary">
          {split.muscles.length} muscle
          {split.muscles.length === 1 ? "" : "s"} · {totalExercises} exercise
          {totalExercises === 1 ? "" : "s"}
        </p>
        <MuscleChips
          muscles={split.muscles}
          lookup={muscles}
          className="mt-3"
        />
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={pending}
        aria-label={`Start ${split.name}`}
        className={cn(
          "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill",
          "bg-accent text-accent-foreground",
          "transition-transform duration-150 active:scale-95 disabled:opacity-40",
        )}
      >
        <svg width="15" height="17" viewBox="0 0 18 20" fill="none">
          <path d="M3 2.5 15.5 10 3 17.5z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
