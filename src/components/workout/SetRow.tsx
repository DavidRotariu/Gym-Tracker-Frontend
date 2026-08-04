"use client";

import { SwipeRow } from "@/components/ui/SwipeRow";
import { SET_TYPE_ORDER, SET_TYPE_SHORT } from "@/components/ui/SetTypeBadge";
import { cn } from "@/lib/utils";
import type { Set, SetType } from "@/types";
import { motion } from "framer-motion";
import { useEffect, useState, type FocusEvent } from "react";

interface SetRowProps {
  set: Set;
  /** Last time this exercise was trained, at the same set number. */
  previous?: { weight: number | null; reps: number | null } | null;
  onChange: (patch: Partial<Set>) => void;
  onDelete: () => void;
  /** Read-only rendering for history playback. */
  readOnly?: boolean;
}

const RIR_OPTIONS: (number | null)[] = [null, 0, 1, 2, 3, 4, 5];

/* Set-type dot: tap the set number to cycle. Mapped to iOS system colors,
   matching SetTypeBadge. */
const dotStyles: Record<SetType, string> = {
  standard: "bg-fill text-label-secondary",
  warmup: "bg-orange-soft text-orange",
  drop: "bg-purple-soft text-purple",
  failure: "bg-red-soft text-red",
};

function NumberField({
  value,
  placeholder,
  onCommit,
  label,
}: {
  value: number | null;
  placeholder: string;
  onCommit: (value: number | null) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isFinite(parsed)) onCommit(Math.max(0, parsed));
    else setDraft(value === null ? "" : String(value));
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={label}
      className={cn(
        "tabular h-9 w-full min-w-0 rounded-control bg-fill text-center text-body font-semibold text-label",
        "placeholder:font-normal placeholder:text-label-tertiary",
      )}
    />
  );
}

/**
 * The active-logging table row: set # (tap to cycle type) · previous ·
 * kg · reps · complete. Swipe left to delete. Marking complete is what
 * fires the rest timer (see the parent's onChange handler).
 */
export function SetRow({ set, previous, onChange, onDelete, readOnly }: SetRowProps) {
  if (readOnly) {
    const weight = set.actual_weight;
    const reps = set.actual_reps;
    const summary =
      weight === null && reps === null ? "Not logged" : `${weight ?? 0} kg × ${reps ?? 0}`;

    return (
      <div
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-control px-3",
          set.completed ? "bg-green-soft" : "bg-background",
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-pill text-caption font-bold",
            dotStyles[set.set_type],
          )}
        >
          {set.set_number}
        </span>
        <span className="tabular flex-1 text-body font-medium text-label">{summary}</span>
        {set.actual_rir !== null && (
          <span className="tabular shrink-0 text-caption text-label-tertiary">
            @{set.actual_rir === 5 ? "5+" : set.actual_rir} RIR
          </span>
        )}
      </div>
    );
  }

  const next = SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(set.set_type) + 1) % SET_TYPE_ORDER.length];
  const hasPrevious = previous?.weight != null || previous?.reps != null;

  function copyPrevious() {
    if (!hasPrevious) return;
    onChange({ actual_weight: previous!.weight, actual_reps: previous!.reps });
  }

  const [rowFocused, setRowFocused] = useState(false);

  function handleBlur(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setRowFocused(false);
    }
  }

  const row = (
    <div
      onFocus={() => setRowFocused(true)}
      onBlur={handleBlur}
      className={cn(
        "transition-colors duration-200",
        set.completed ? "bg-green-soft" : "bg-background",
      )}
    >
      <div className="grid min-h-12 grid-cols-[32px_1fr_64px_56px_44px] items-center gap-2 px-2">
        <button
          type="button"
          onClick={() => onChange({ set_type: next })}
          aria-label={`Set ${set.set_number}, type ${set.set_type}. Tap to change type.`}
          className={cn(
            "flex size-8 cursor-pointer items-center justify-center rounded-pill text-caption font-bold active:opacity-70",
            dotStyles[set.set_type],
          )}
        >
          {set.set_type === "standard" ? set.set_number : SET_TYPE_SHORT[set.set_type]}
        </button>

        <button
          type="button"
          onClick={copyPrevious}
          disabled={!hasPrevious}
          aria-label={
            hasPrevious
              ? `Copy previous: ${previous!.weight ?? "—"} kg × ${previous!.reps ?? "—"}`
              : "No previous set"
          }
          className="tabular truncate text-left text-caption text-label-tertiary disabled:cursor-default active:opacity-60"
        >
          {hasPrevious ? `${previous!.weight ?? "—"} kg × ${previous!.reps ?? "—"}` : "—"}
        </button>

        <NumberField
          value={set.actual_weight}
          placeholder={previous?.weight != null ? String(previous.weight) : "—"}
          onCommit={(v) => onChange({ actual_weight: v })}
          label={`Set ${set.set_number} weight`}
        />

        <NumberField
          value={set.actual_reps}
          placeholder={previous?.reps != null ? String(previous.reps) : "—"}
          onCommit={(v) => onChange({ actual_reps: v })}
          label={`Set ${set.set_number} reps`}
        />

        <motion.button
          type="button"
          onClick={() =>
            onChange({
              completed: !set.completed,
              completed_at: set.completed ? null : new Date().toISOString(),
            })
          }
          aria-pressed={set.completed}
          aria-label={
            set.completed
              ? `Set ${set.set_number} complete`
              : `Mark set ${set.set_number} complete — starts the rest timer`
          }
          animate={set.completed ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.34, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center"
        >
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-pill transition-colors duration-150",
              set.completed ? "bg-green text-white" : "bg-fill text-label-tertiary",
            )}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path
                d="M4.5 10.5l3.6 3.6L15.5 6"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </motion.button>
      </div>

      {/* Compact RIR strip — only while this row has focus, never widens
          the table above. */}
      {rowFocused && (
        <div className="flex items-center gap-2 px-2 pt-1 pb-2 pl-10">
          <span className="text-tab font-medium text-label-tertiary uppercase">
            RIR
          </span>
          <div className="flex gap-1">
            {RIR_OPTIONS.map((option) => (
              <button
                key={String(option)}
                type="button"
                onClick={() => onChange({ actual_rir: option })}
                aria-pressed={set.actual_rir === option}
                className={cn(
                  "tabular flex size-7 cursor-pointer items-center justify-center rounded-pill text-tab font-semibold",
                  set.actual_rir === option
                    ? "bg-accent text-accent-foreground"
                    : "bg-fill text-label-secondary active:opacity-70",
                )}
              >
                {option === null ? "—" : option === 5 ? "5+" : option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <SwipeRow
      bare
      className="rounded-control"
      actions={[{ label: "Delete", variant: "destructive", onAction: onDelete }]}
    >
      {row}
    </SwipeRow>
  );
}
