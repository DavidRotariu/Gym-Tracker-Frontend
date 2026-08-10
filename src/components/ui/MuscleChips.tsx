import { shortMuscleName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Muscle, SplitMuscle } from "@/types";

interface MuscleChipsProps {
  muscles: SplitMuscle[];
  lookup: Map<string, string> | Muscle[] | undefined;
  className?: string;
}

function nameOf(lookup: MuscleChipsProps["lookup"], id: string): string {
  if (!lookup) return `#${id}`;
  const name = lookup instanceof Map ? lookup.get(id) : lookup.find((m) => m.id === id)?.name;
  return name ? shortMuscleName(name) : `#${id}`;
}

/** "Chest ×3" pills describing a split's muscle allocation. */
export function MuscleChips({ muscles, lookup, className }: MuscleChipsProps) {
  if (muscles.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {muscles.map((m) => (
        <li
          key={m.muscle_id}
          className="rounded-pill bg-fill px-3 py-1 text-caption font-medium text-label-secondary"
        >
          {nameOf(lookup, m.muscle_id)}
          <span className="tabular ml-1 text-label-tertiary">
            ×{m.nr_of_exercises}
          </span>
        </li>
      ))}
    </ul>
  );
}
