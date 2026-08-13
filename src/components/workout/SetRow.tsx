"use client";

import { SwipeRow } from "@/components/ui/SwipeRow";
import { SET_TYPE_ORDER, SET_TYPE_SHORT } from "@/components/ui/SetTypeBadge";
import { useNumericKeypad, type KeypadKey } from "@/components/workout/NumericKeypad";
import { cn } from "@/lib/utils";
import type { ExerciseType, Set, SetType } from "@/types";
import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

type NumberFieldKind = "weight" | "reps";

interface SetRowProps {
  set: Set;
  /** Last time this exercise was trained, at the same set number. */
  previous?: { weight: number | null; reps: number | null } | null;
  onChange: (patch: Partial<Set>) => void;
  onDelete: () => void;
  /** Read-only rendering for history playback. */
  readOnly?: boolean;
  /** Governs which fields this row logs: weighted/negative show kg + reps,
   *  body_weight shows reps only, timer shows seconds only (stored in the
   *  same actual_reps field — there's no separate duration column). */
  exerciseType?: ExerciseType;
  /** Live-mirrored text from an earlier set still being typed into (see
   *  ExerciseCard) — shown in place of this field's own value while set. */
  weightOverride?: string;
  repsOverride?: string;
  /** Every keystroke while this row's weight/reps field is the one being
   *  typed into, so ExerciseCard can mirror it into later empty sets. */
  onFieldDraft?: (field: NumberFieldKind, draft: string) => void;
  onFieldEditEnd?: (field: NumberFieldKind) => void;
}

/* Set-type dot: tap the set number to cycle. Mapped to iOS system colors,
   matching SetTypeBadge. */
const dotStyles: Record<SetType, string> = {
  standard: "bg-fill text-label-secondary",
  warmup: "bg-orange-soft text-orange",
  drop: "bg-purple-soft text-purple",
  myorep: "bg-red-soft text-red",
};

/** weighted/negative log kg + reps; body_weight logs reps only; timer logs
 *  seconds only (still stored in actual_reps — there's no duration column). */
function showsWeight(exerciseType?: ExerciseType): boolean {
  return exerciseType !== "body_weight" && exerciseType !== "timer";
}

function formatSet(
  weight: number | null,
  reps: number | null,
  exerciseType: ExerciseType | undefined,
  empty: string,
): string {
  if (exerciseType === "timer") return `${reps ?? empty}s`;
  if (exerciseType === "body_weight") return `${reps ?? empty} reps`;
  return `${weight ?? empty} kg × ${reps ?? empty}`;
}

/**
 * A button, not a real `<input>` — tapping it makes the shared custom
 * keypad (NumericKeypad) active for this field instead of popping the OS's
 * decimal keyboard. The field owns its draft and writes keypresses straight
 * into it, so the button itself is the only "display" — no separate number
 * readout in the keypad to keep in sync.
 */
function NumberField({
  value,
  placeholder,
  onCommit,
  label,
  override,
  onDraft,
  onEditEnd,
}: {
  value: number | null;
  placeholder: string;
  onCommit: (value: number | null) => void;
  label: string;
  /** Someone else's live draft, mirrored here while this field is still
   *  blank (see ExerciseCard) — shown instead of this field's own value. */
  override?: string;
  onDraft?: (draft: string) => void;
  onEditEnd?: () => void;
}) {
  const fieldId = useId();
  const keypad = useNumericKeypad();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  // The keypad calls back through a callback captured once by open(), so it
  // needs a way to see the *current* draft/value from outside the render
  // that created it — synced in an effect, never written during render.
  const draftRef = useRef(draft);
  const valueRef = useRef(value);
  const overrideRef = useRef(override);
  // Set the moment this field opens with existing text showing (typed,
  // committed, or mirrored) — the *next* keypress replaces it outright
  // instead of appending, since opening a field that already has a number
  // is someone correcting it, not extending it.
  const replaceOnNextKeyRef = useRef(false);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    overrideRef.current = override;
  }, [override]);

  useEffect(() => {
    valueRef.current = value;
    setDraft(value === null ? "" : String(value));
  }, [value]);

  function commit() {
    const trimmed = draftRef.current.trim();
    onEditEnd?.();
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isFinite(parsed)) onCommit(Math.max(0, parsed));
    else setDraft(valueRef.current === null ? "" : String(valueRef.current));
  }

  function handleKey(key: KeypadKey) {
    const prev = draftRef.current;
    let next: string;
    if (replaceOnNextKeyRef.current) {
      replaceOnNextKeyRef.current = false;
      next = key === "del" ? "" : key === "." ? "0." : key;
    } else if (key === "del") {
      next = prev.slice(0, -1);
    } else if (key === "." && prev.includes(".")) {
      next = prev;
    } else if (prev.length >= 6) {
      next = prev;
    } else {
      next = prev + key;
    }
    setDraft(next);
    draftRef.current = next;
    onDraft?.(next);
  }

  function openField() {
    // Seed the field's own draft from whatever's actually showing —
    // including a mirrored value it never locally typed — so typing,
    // backspace, and commit all act on what the lifter can see.
    const shown = overrideRef.current ?? draftRef.current;
    if (shown !== draftRef.current) {
      setDraft(shown);
      draftRef.current = shown;
    }
    replaceOnNextKeyRef.current = shown !== "";
    keypad.open({ id: fieldId, onKey: handleKey, onCommit: commit });
    // Safari/iOS doesn't focus a <button> on tap the way it does a real
    // <input> — without this, tapping a weight/reps field never bubbles a
    // focus event, so the session page's scroll-spy (onFocus, see
    // handleExerciseAreaFocus) never learns this card is now the active one.
    buttonRef.current?.focus();
  }

  const active = keypad.activeId === fieldId;
  const shown = override ?? draft;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={openField}
      aria-label={label}
      className={cn(
        "tabular h-9 w-full min-w-0 cursor-pointer rounded-control bg-fill text-center text-body font-semibold text-label",
        active && "outline-2 outline-offset-0 outline-blue",
        shown === "" && "font-normal text-label-tertiary",
      )}
    >
      {shown || placeholder}
    </button>
  );
}

/**
 * The active-logging table row: set # (tap to cycle type) · previous ·
 * kg · reps · complete. Swipe left to delete. Marking complete is what
 * fires the rest timer (see the parent's onChange handler).
 */
export function SetRow({
  set,
  previous,
  onChange,
  onDelete,
  readOnly,
  exerciseType,
  weightOverride,
  repsOverride,
  onFieldDraft,
  onFieldEditEnd,
}: SetRowProps) {
  const showWeight = showsWeight(exerciseType);

  if (readOnly) {
    const weight = set.actual_weight;
    const reps = set.actual_reps;
    const summary =
      weight === null && reps === null
        ? "Not logged"
        : formatSet(weight, reps, exerciseType, "0");

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
      </div>
    );
  }

  const next = SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(set.set_type) + 1) % SET_TYPE_ORDER.length];
  const hasPrevious = previous?.weight != null || previous?.reps != null;
  const isTimer = exerciseType === "timer";

  function copyPrevious() {
    if (!hasPrevious) return;
    onChange({ actual_weight: previous!.weight, actual_reps: previous!.reps });
  }

  const row = (
    <div
      className={cn(
        "grid min-h-12 items-center gap-2 px-2 transition-colors duration-200",
        showWeight ? "grid-cols-[32px_1fr_64px_56px_44px]" : "grid-cols-[32px_1fr_64px_44px]",
        set.completed ? "bg-green-soft" : "bg-background",
      )}
    >
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
        aria-label={hasPrevious ? `Copy previous: ${formatSet(previous!.weight, previous!.reps, exerciseType, "—")}` : "No previous set"}
        className="tabular truncate text-left text-caption text-label-tertiary disabled:cursor-default active:opacity-60"
      >
        {hasPrevious ? formatSet(previous!.weight, previous!.reps, exerciseType, "—") : "—"}
      </button>

      {showWeight && (
        <NumberField
          value={set.actual_weight}
          placeholder={previous?.weight != null ? String(previous.weight) : "—"}
          onCommit={(v) =>
            onChange({
              actual_weight: exerciseType === "negative" && v !== null ? -Math.abs(v) : v,
            })
          }
          label={`Set ${set.set_number} weight`}
          override={weightOverride}
          onDraft={(d) => onFieldDraft?.("weight", d)}
          onEditEnd={() => onFieldEditEnd?.("weight")}
        />
      )}

      <NumberField
        value={set.actual_reps}
        placeholder={previous?.reps != null ? String(previous.reps) : "—"}
        onCommit={(v) => onChange({ actual_reps: v })}
        label={`Set ${set.set_number} ${isTimer ? "seconds" : "reps"}`}
        override={repsOverride}
        onDraft={(d) => onFieldDraft?.("reps", d)}
        onEditEnd={() => onFieldEditEnd?.("reps")}
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
