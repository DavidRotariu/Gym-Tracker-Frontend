"use client";

import { MediaThumb } from "@/components/ui/MediaThumb";
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
 * Hand-drawn icons for the three default splits — swapped in ahead of the
 * muscle-thumbnail stack for any split whose name matches. Everything else
 * (custom user splits) still falls back to the muscle stack.
 */
const SPLIT_ICONS: { match: RegExp; src: string }[] = [
  { match: /push/i, src: "/split-icons/push.png" },
  { match: /pull/i, src: "/split-icons/pull.png" },
  { match: /leg/i, src: "/split-icons/legs.png" },
];

/**
 * Row content only — the list wraps this in a SwipeRow, which supplies the
 * card surface and the edit/delete actions.
 */
export function SplitCard({ split, muscles, onStart, pending }: SplitCardProps) {
  const totalExercises = split.muscles.reduce(
    (sum, m) => sum + m.nr_of_exercises,
    0,
  );

  const splitIcon = SPLIT_ICONS.find((s) => s.match.test(split.name))?.src;

  const targetMuscles = split.muscles
    .map((m) => muscles?.find((muscle) => muscle.id === m.muscle_id))
    .filter((m): m is Muscle => m !== undefined)
    .slice(0, 3);

  return (
    <div className="flex items-center gap-4 p-4">
      {splitIcon ? (
        <MediaThumb
          src={splitIcon}
          alt=""
          static
          fallback={
            <span className="text-caption font-bold text-label-tertiary">
              {split.name.slice(0, 1)}
            </span>
          }
          className="size-11 shrink-0 rounded-control object-contain"
        />
      ) : (
        targetMuscles.length > 0 &&
        (targetMuscles.length === 1 ? (
          <MediaThumb
            src={targetMuscles[0].image_url}
            alt=""
            static
            fallback={
              <span className="text-caption font-bold text-label-tertiary">
                {targetMuscles[0].name.slice(0, 1)}
              </span>
            }
            className="size-11 shrink-0 rounded-control"
          />
        ) : (
          <div className="flex shrink-0 -space-x-3">
            {targetMuscles.map((m) => (
              <MediaThumb
                key={m.id}
                src={m.image_url}
                alt=""
                static
                fallback={
                  <span className="text-tab font-bold text-label-tertiary">
                    {m.name.slice(0, 1)}
                  </span>
                }
                className="size-9 shrink-0 rounded-pill ring-2 ring-background-secondary"
              />
            ))}
          </div>
        ))
      )}

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
