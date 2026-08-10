import { cn } from "@/lib/utils";
import type { SetType } from "@/types";

export const SET_TYPE_LABEL: Record<SetType, string> = {
  standard: "Standard",
  warmup: "Warm-up",
  drop: "Drop",
  myorep: "Myo-rep",
};

/** Compact glyph used inside dense set rows. */
export const SET_TYPE_SHORT: Record<SetType, string> = {
  standard: "W",
  warmup: "WU",
  drop: "DS",
  myorep: "MR",
};

export const SET_TYPE_ORDER: SetType[] = [
  "standard",
  "warmup",
  "drop",
  "myorep",
];

/* Mapped to iOS system colors semantically: warm-up = orange, drop = purple,
   myo-rep = red. */
const styles: Record<SetType, string> = {
  standard: "bg-fill text-label-secondary",
  warmup: "bg-orange-soft text-orange",
  drop: "bg-purple-soft text-purple",
  myorep: "bg-red-soft text-red",
};

/**
 * The circular set-type chip used in the active-logging table (see
 * SetRow.tsx) — shown here elsewhere so the same glyph explains itself
 * outside that context (e.g. Profile's set-type legend).
 */
export function SetTypeDot({
  type,
  className,
}: {
  type: SetType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-pill text-caption font-bold",
        styles[type],
        className,
      )}
    >
      {SET_TYPE_SHORT[type]}
    </span>
  );
}

interface SetTypeBadgeProps {
  type: SetType;
  short?: boolean;
  /** Renders as a button that cycles to the next set type. */
  onCycle?: (next: SetType) => void;
  className?: string;
}

export function SetTypeBadge({
  type,
  short,
  onCycle,
  className,
}: SetTypeBadgeProps) {
  const label = short ? SET_TYPE_SHORT[type] : SET_TYPE_LABEL[type];
  const base = cn(
    "inline-flex items-center justify-center rounded-pill px-2 py-1",
    "text-tab font-bold uppercase",
    styles[type],
    className,
  );

  if (!onCycle) return <span className={base}>{label}</span>;

  const next =
    SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(type) + 1) % SET_TYPE_ORDER.length];

  return (
    <button
      type="button"
      onClick={() => onCycle(next)}
      aria-label={`Set type: ${SET_TYPE_LABEL[type]}. Tap for ${SET_TYPE_LABEL[next]}.`}
      /* Visually a small pill, but the hit area is a full 44px square. */
      className={cn(
        "relative flex size-11 cursor-pointer items-center justify-center active:opacity-60",
      )}
    >
      <span className={base}>{label}</span>
    </button>
  );
}
