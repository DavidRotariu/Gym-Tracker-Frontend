"use client";

import { Stepper } from "@/components/ui/Stepper";
import { shortMuscleName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Muscle, SplitMuscle } from "@/types";

interface MuscleAllocatorProps {
  muscles: Muscle[];
  allocation: SplitMuscle[];
  onChange: (allocation: SplitMuscle[]) => void;
}

export function MuscleAllocator({
  muscles,
  allocation,
  onChange,
}: MuscleAllocatorProps) {
  function toggle(muscleId: string) {
    const exists = allocation.some((a) => a.muscle_id === muscleId);
    onChange(
      exists
        ? allocation.filter((a) => a.muscle_id !== muscleId)
        : [...allocation, { muscle_id: muscleId, nr_of_exercises: 2 }],
    );
  }

  function setCount(muscleId: string, count: number) {
    onChange(
      allocation.map((a) =>
        a.muscle_id === muscleId
          ? { ...a, nr_of_exercises: Math.max(1, count) }
          : a,
      ),
    );
  }

  return (
    <div className="overflow-hidden rounded-card bg-background-secondary">
      <ul className="divide-y divide-separator">
        {muscles.map((muscle) => {
          const entry = allocation.find((a) => a.muscle_id === muscle.id);
          const active = !!entry;

          return (
            <li key={muscle.id} className="flex items-center gap-3 px-4 py-2">
              <button
                type="button"
                onClick={() => toggle(muscle.id)}
                aria-pressed={active}
                className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-pill transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "bg-fill text-transparent",
                  )}
                >
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M4.5 10.5l3.6 3.6L15.5 6"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span
                  className={cn(
                    "text-body",
                    active
                      ? "font-semibold text-label"
                      : "text-label-secondary",
                  )}
                >
                  {shortMuscleName(muscle.name)}
                </span>
              </button>

              {active && (
                <div className="w-[136px] shrink-0">
                  <Stepper
                    hideLabel
                    label={`${muscle.name} exercises`}
                    value={entry.nr_of_exercises}
                    min={1}
                    max={10}
                    onChange={(v) => setCount(muscle.id, v)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
