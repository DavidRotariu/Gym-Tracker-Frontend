"use client";

import { SwipeRow } from "@/components/ui/SwipeRow";
import { SET_TYPE_ORDER, SET_TYPE_SHORT, SET_TYPE_STYLES } from "@/components/ui/SetTypeBadge";
import type { LoadRequest } from "@/components/workout/EquipmentLoadPanel";
import { useNumericKeypad, type KeypadKey } from "@/components/workout/NumericKeypad";
import { EQUIPMENT, formatWeight, parseWeightDraft, weightStep, weightUnit, type EquipmentType } from "@/lib/equipment";
import { playCompleteFeedback } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import type { ExerciseType, Set } from "@/types";
import { motion } from "framer-motion";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

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
  /** Governs how the weight reads and how it's loaded — see lib/equipment. */
  equipment?: EquipmentType | null;
  /** Live-mirrored text from an earlier set still being typed into (see
   *  ExerciseCard) — shown in place of this field's own value while set. */
  weightOverride?: string;
  repsOverride?: string;
  /** Every keystroke while this row's weight/reps field is the one being
   *  typed into, so ExerciseCard can mirror it into later empty sets. */
  onFieldDraft?: (field: NumberFieldKind, draft: string) => void;
  onFieldEditEnd?: (field: NumberFieldKind) => void;
}

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
  equipment?: EquipmentType | null,
): string {
  if (exerciseType === "timer") return `${reps ?? empty}s`;
  if (exerciseType === "body_weight") return `${reps ?? empty} reps`;
  const sign = exerciseType === "negative" && weight ? "−" : "";
  return `${sign}${formatWeight(weight ?? empty, equipment)} × ${reps ?? empty}`;
}

/**
 * A button, not a real `<input>` — tapping it makes the shared custom
 * keypad (NumericKeypad) active for this field instead of popping the OS's
 * decimal keyboard. The field owns its draft and writes keypresses straight
 * into it, so the button itself is the only "display" — no separate number
 * readout in the keypad to keep in sync.
 */
const MAX_WEIGHT = 2000; // kg
const MAX_REPS = 999;
const MAX_SECONDS = 3600;

function NumberField({
  value,
  placeholder,
  onCommit,
  label,
  override,
  onDraft,
  onEditEnd,
  prefix = "",
  integer = false,
  max,
  openRef,
  loadRequest,
  step,
}: {
  /** How much the keypad's + and − change this value by. */
  step: number;
  /** What the keypad's loading panel shows while this field is being edited. */
  loadRequest?: (shown: string) => LoadRequest | null;
  /** Display-only (e.g. "−" for negative exercises); never part of the stored number. */
  prefix?: string;
  /** Whole numbers only (reps, seconds) — no "." key, and no fractions stored. */
  integer?: boolean;
  /** Largest value accepted — anything above is clamped on commit. */
  max: number;
  /** Lets the row open this field programmatically (see the ✓ guard). */
  openRef?: React.RefObject<(() => void) | null>;
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

  // The keypad holds the `commit` captured when this field opened; that commit
  // must call the *latest* onCommit (it closes over the session's current
  // sets for the forward-fill), not the one from the render that opened it.
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    overrideRef.current = override;
  }, [override]);

  // A new value from outside (the optimistic write, a rollback, a refetch)
  // replaces the draft — adjusted while rendering rather than in an effect.
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    setDraft(value === null ? "" : String(value));
  }
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function commit() {
    const trimmed = draftRef.current.trim();
    onEditEnd?.();
    const parsed = Number(trimmed.replace(",", "."));
    if (trimmed !== "" && !Number.isFinite(parsed)) {
      setDraft(valueRef.current === null ? "" : String(valueRef.current));
      return;
    }
    // Whole numbers for reps/seconds, at most 2 decimals for weight, never
    // negative, never above `max` — values the backend can store.
    const bounded = Math.min(max, Math.max(0, integer ? Math.round(parsed) : Math.round(parsed * 100) / 100));
    const next = trimmed === "" ? null : bounded;
    // Opening and closing a field without changing it isn't an edit — don't
    // queue a write for it.
    if (next === valueRef.current) {
      setDraft(next === null ? "" : String(next));
      return;
    }
    // Record it now, not when the optimistic value comes back through props:
    // a second commit before that re-render (press-to-save, then the release
    // that closes the keypad) would otherwise see a stale value and queue the
    // same write twice.
    valueRef.current = next;
    onCommitRef.current(next);
  }

  function handleKey(key: KeypadKey) {
    const prev = draftRef.current;
    let next: string;
    if (replaceOnNextKeyRef.current) {
      replaceOnNextKeyRef.current = false;
      next = key === "del" ? "" : key === "." ? "0." : key;
    } else if (key === "del") {
      next = prev.slice(0, -1);
    } else if (key === "." && (integer || prev.includes("."))) {
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

  // Starts from what's showing, or the placeholder if that's what ✓ would log.
  function handleStep(direction: 1 | -1) {
    const current = parseWeightDraft(draftRef.current) ?? parseWeightDraft(placeholder) ?? 0;
    const next = String(Math.min(max, Math.max(0, Math.round((current + direction * step) * 100) / 100)));
    replaceOnNextKeyRef.current = true;
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
    // Coming back after putting the keypad away is carrying on, not correcting.
    replaceOnNextKeyRef.current = shown !== "" && !keypad.wasDismissedFrom(fieldId);
    keypad.open({
      id: fieldId,
      onKey: handleKey,
      onCommit: commit,
      onStep: handleStep,
      target: buttonRef.current,
      decimal: !integer,
      load: loadRequest?.(shown) ?? null,
    });
    // Safari/iOS doesn't focus a <button> on tap the way it does a real
    // <input> — without this, tapping a weight/reps field never bubbles a
    // focus event, so the session page's scroll-spy (onFocus, see
    // handleExerciseAreaFocus) never learns this card is now the active one.
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (openRef) openRef.current = openField;
  });

  const active = keypad.activeId === fieldId;
  const shown = override ?? draft;

  // Layout effect: the panel has to match this field in the same paint it opens.
  const load = active ? (loadRequest?.(shown) ?? null) : null;
  const { setLoad } = keypad;
  useLayoutEffect(() => {
    if (active) setLoad(load);
    // Compared by value: `load` is a fresh object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, setLoad, load?.sourceKey, load?.equipment, load?.weight]);

  return (
    <button
      ref={buttonRef}
      type="button"
      data-keypad-field
      onClick={openField}
      aria-label={label}
      className={cn(
        "tabular h-10 w-full min-w-0 cursor-pointer rounded-control bg-fill text-center text-body font-semibold text-label",
        active && "outline-2 outline-offset-0 outline-blue",
        shown === "" && "font-normal text-label-tertiary",
      )}
    >
      {shown ? prefix + shown : placeholder}
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
  equipment,
  weightOverride,
  repsOverride,
  onFieldDraft,
  onFieldEditEnd,
}: SetRowProps) {
  const showWeight = showsWeight(exerciseType);

  // Born optimistic = just added by the user (not loaded from the server), so
  // it gets the "new row" tint once. The row instance survives the optimistic →
  // real id swap (stable key in ExerciseCard), so this stays true, harmlessly.
  const [isNew] = useState(() => set.id.startsWith("optimistic-"));
  // Completion feedback is purely visual sugar on top of the state change:
  // `ring` bumps once per genuine tick so the check can emit one soft pulse.
  const [ring, setRing] = useState(0);
  const openReps = useRef<(() => void) | null>(null);
  const lastToggleAt = useRef(-Infinity);

  if (readOnly) {
    const weight = set.actual_weight;
    const reps = set.actual_reps;
    const summary =
      weight === null && reps === null
        ? "Not logged"
        : formatSet(weight, reps, exerciseType, "0", equipment);

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
            SET_TYPE_STYLES[set.set_type],
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

  // Placeholder row (see useLogSet) — the server doesn't know this id yet, so
  // any edit would PATCH a 404 and roll straight back. Hold input until the
  // real row replaces it (a beat later).
  const unsaved = set.id.startsWith("optimistic-");

  // Blank means the placeholder (last time's weight), which is what ✓ would log.
  function loadFor(weight: number | null): LoadRequest | null {
    if (exerciseType !== "weighted" || !equipment || !EQUIPMENT[equipment].plates) return null;
    return { sourceKey: set.id, equipment, weight: weight ?? previous?.weight ?? null };
  }

  const row = (
    <div
      className={cn(
        "grid min-h-13 items-center gap-2 px-2 transition-colors duration-200",
        isNew && "set-new",
        unsaved && "pointer-events-none opacity-70",
        showWeight ? "grid-cols-[32px_1fr_64px_56px_44px]" : "grid-cols-[32px_1fr_64px_44px]",
        set.completed ? "bg-green-soft" : "bg-background",
      )}
    >
      <button
        type="button"
        onClick={() => onChange({ set_type: next })}
        aria-label={`Set ${set.set_number}, type ${set.set_type}. Tap to change type.`}
        className={cn(
          "relative flex size-8 cursor-pointer items-center justify-center rounded-pill text-caption font-bold active:opacity-70 before:absolute before:-inset-1.5 before:content-['']",
          SET_TYPE_STYLES[set.set_type],
        )}
      >
        {set.set_type === "standard" ? set.set_number : SET_TYPE_SHORT[set.set_type]}
      </button>

      <button
        type="button"
        onClick={copyPrevious}
        disabled={!hasPrevious}
        aria-label={hasPrevious ? `Copy previous: ${formatSet(previous!.weight, previous!.reps, exerciseType, "—", equipment)}` : "No previous set"}
        className="tabular truncate text-left text-caption text-label-tertiary disabled:cursor-default active:opacity-60"
      >
        {hasPrevious ? formatSet(previous!.weight, previous!.reps, exerciseType, "—") : "—"}
      </button>

      {showWeight && (
        <NumberField
          value={set.actual_weight}
          placeholder={previous?.weight != null ? String(previous.weight) : "—"}
          max={MAX_WEIGHT}
          step={weightStep(equipment)}
          prefix={exerciseType === "negative" ? "−" : ""}
          onCommit={(v) => onChange({ actual_weight: v })}
          label={`Set ${set.set_number} weight, ${weightUnit(equipment)}`}
          loadRequest={(shown) => loadFor(parseWeightDraft(shown))}
          override={weightOverride}
          onDraft={(d) => onFieldDraft?.("weight", d)}
          onEditEnd={() => onFieldEditEnd?.("weight")}
        />
      )}

      <NumberField
        value={set.actual_reps}
        integer
        max={isTimer ? MAX_SECONDS : MAX_REPS}
        step={isTimer ? 5 : 1}
        openRef={openReps}
        // Same row, same bar: moving on to reps keeps the plates where they are.
        loadRequest={() => loadFor(parseWeightDraft(weightOverride ?? "") ?? set.actual_weight)}
        placeholder={previous?.reps != null ? String(previous.reps) : "—"}
        onCommit={(v) => onChange({ actual_reps: v })}
        label={`Set ${set.set_number} ${isTimer ? "seconds" : "reps"}`}
        override={repsOverride}
        onDraft={(d) => onFieldDraft?.("reps", d)}
        onEditEnd={() => onFieldEditEnd?.("reps")}
      />

      <motion.button
        type="button"
        onClick={() => {
          // A completed set with no reps (nothing typed, nothing to carry over
          // from last time) would be logged as a done set with no data — open
          // the reps field instead of ticking it off.
          if (!set.completed && set.actual_reps === null && previous?.reps == null) {
            openReps.current?.();
            return;
          }
          // ✓ is a toggle, so a double tap used to tick *and untick* the set
          // (restarting the rest timer twice on the way). A second tap this
          // soon is the same intention repeated, not a request to undo.
          const t = performance.now();
          if (t - lastToggleAt.current < 400) return;
          lastToggleAt.current = t;
          if (!set.completed) {
            setRing((n) => n + 1);
            playCompleteFeedback();
          }
          onChange({
            completed: !set.completed,
            completed_at: set.completed ? null : new Date().toISOString(),
            // The blank fields show the previous session's numbers as
            // placeholders; completing without typing means "same as that",
            // not "0 kg × 0" — log what the row visibly suggests.
            ...(!set.completed && set.actual_weight === null && showWeight && previous?.weight != null
              ? { actual_weight: previous.weight }
              : {}),
            ...(!set.completed && set.actual_reps === null && previous?.reps != null
              ? { actual_reps: previous.reps }
              : {}),
          });
        }}
        aria-pressed={set.completed}
        aria-label={
          set.completed
            ? `Set ${set.set_number} complete`
            : `Mark set ${set.set_number} complete — starts the rest timer`
        }
        // initial={false}: no pop for sets that are *already* complete when the
        // row mounts (opening the workout, coming back from exercise detail).
        initial={false}
        animate={set.completed ? { scale: [1, 1.14, 1] } : { scale: 1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center"
      >
        {set.completed && ring > 0 && (
          <motion.span
            key={ring}
            aria-hidden
            initial={{ scale: 0.9, opacity: 0.45 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="pointer-events-none absolute size-8 rounded-pill border-2 border-green"
          />
        )}
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-pill transition-colors duration-150",
            set.completed ? "bg-green text-background" : "bg-fill text-label-tertiary",
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
