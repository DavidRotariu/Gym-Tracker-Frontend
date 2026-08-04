"use client";

import { cn } from "@/lib/utils";

interface RirPickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

const OPTIONS: (number | null)[] = [null, 0, 1, 2, 3, 4, 5];

function label(value: number | null) {
  if (value === null) return "—";
  if (value === 5) return "5+";
  return String(value);
}

/**
 * RIR is a small integer picked constantly — a segmented control is one tap
 * where a stepper would be several.
 */
export function RirPicker({ value, onChange }: RirPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-medium text-label-secondary">
        Reps in reserve
      </span>
      <div
        role="radiogroup"
        aria-label="Reps in reserve"
        className="flex gap-1 rounded-button bg-fill p-1"
      >
        {OPTIONS.map((option) => {
          const selected = value === option;
          return (
            <button
              key={String(option)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option)}
              className={cn(
                "tabular h-11 flex-1 cursor-pointer rounded-control text-body font-semibold",
                "transition-colors duration-150",
                selected
                  ? "bg-accent text-accent-foreground"
                  : "text-label-secondary active:bg-background",
              )}
            >
              {label(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
