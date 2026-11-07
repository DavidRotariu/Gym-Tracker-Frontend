import { shortMuscleName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Muscle, SplitMuscle } from "@/types";

interface MuscleChipsProps {
  muscles: SplitMuscle[];
  lookup: Map<string, string> | Muscle[] | undefined;
  className?: string;
}

/** Undefined while the muscle list is loading (or the id is unknown) — never the raw id. */
function nameOf(lookup: MuscleChipsProps["lookup"], id: string): string | undefined {
  if (!lookup) return undefined;
  const name = lookup instanceof Map ? lookup.get(id) : lookup.find((m) => m.id === id)?.name;
  return name ? shortMuscleName(name) : undefined;
}

/** "Chest ×3" pills describing a split's muscle allocation. */
export function MuscleChips({ muscles, lookup, className }: MuscleChipsProps) {
  if (muscles.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {muscles.map((m) => {
        const name = nameOf(lookup, m.muscle_id);
        // Skeleton pill of roughly the final size until the name resolves.
        if (!name)
          return (
            <li
              key={m.muscle_id}
              aria-hidden
              className="h-7 w-20 animate-pulse rounded-pill bg-fill"
            />
          );
        return (
          <li
            key={m.muscle_id}
            className="rounded-pill bg-fill px-3 py-1 text-caption font-medium text-label-secondary"
          >
            {name}
            <span className="tabular ml-1 text-label-tertiary">
              ×{m.nr_of_exercises}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
