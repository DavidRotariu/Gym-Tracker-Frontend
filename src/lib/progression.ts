/**
 * Progressive-overload prescription for the 8–12 rep range: what to preset a
 * set to, given the same set from last session. Hybrid "e1RM solve + double
 * progression": estimate e1RM from last time (Epley on reps +
 * RIR), add a small planned gain, solve for this session's load at the target
 * reps, round down to a real increment, and when rounding blocks a load
 * increase, add a rep instead. Every session is some overload.
 *
 * ponytail: no program/week-target exists in the app, so each set's target is
 * last time's reps + 1 (the spec's "one rep a week" plan). Deload detection and
 * per-exercise Epley-k fitting are skipped — add when weekly e1RM is tracked.
 */
import type { ExerciseHistoryEntry, SetType } from "@/types";

const REP_MIN = 8;
const REP_MAX = 12;
const TARGET_RIR = 1;
const DEFAULT_RIR = 1;
const WEEKLY_GAIN = 0.01;
const EPLEY_K = 30;
const MAX_CHANGE = 0.1;
const OVERFLOW_REPS = 1;

export interface LastSet {
  set_number: number;
  set_type: SetType;
  actual_weight: number | null;
  actual_reps: number | null;
  actual_rir: number | null;
}

export interface Prescription {
  set_type: SetType;
  weight: number | null;
  reps: number | null;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
// Round to the increment, then to 2 decimals so 3 × 2.5 never shows as 7.499999.
const roundDown = (x: number, inc: number) => Math.round(Math.floor(x / inc + 1e-9) * inc * 100) / 100;
const repsAt = (e1: number, weight: number) => EPLEY_K * (e1 / weight - 1) - TARGET_RIR;

/**
 * The last session this exercise was actually done in. A session where it sat
 * on the card but every set was skipped (no reps) doesn't count — otherwise
 * skipping it once would wipe its sets and suggestions next time. History
 * comes newest first; `sessionId` is the workout in progress.
 */
export function lastPerformed<T extends Pick<ExerciseHistoryEntry, "workout_session_id" | "sets">>(
  history: T[] | null | undefined,
  sessionId?: string,
): T | undefined {
  return history?.find((h) => h.workout_session_id !== sessionId && h.sets.some((s) => s.actual_reps !== null));
}

/** Spec heuristic: strength fades after a layoff — scale e1RM down before solving. */
export function gapDecay(daysSince: number): number {
  if (daysSince > 28) return 0.9;
  if (daysSince > 14) return 0.95;
  return 1;
}

/** One working set: last time's weight × reps (+ RIR) → this session's weight × reps. */
export function prescribeSet(
  weight: number,
  reps: number,
  rir: number | null,
  increment: number,
  decay = 1,
): { weight: number; reps: number } {
  const target = clamp(reps + 1, REP_MIN, REP_MAX);
  const projected = weight * (1 + (reps + (rir ?? DEFAULT_RIR)) / EPLEY_K) * (1 + WEEKLY_GAIN) * decay;
  const raw = clamp(
    projected / (1 + (target + TARGET_RIR) / EPLEY_K),
    weight * (1 - MAX_CHANGE),
    weight * (1 + MAX_CHANGE),
  );
  // Rounded relative to last time's weight, so an off-grid load (a 22 kg
  // dumbbell, a 23 kg stack pin) stays on the lifter's own steps.
  const rounded = Math.round((weight + roundDown(raw - weight, increment)) * 100) / 100;

  if (rounded > weight) return { weight: rounded, reps: target };
  if (rounded < weight && (reps < REP_MIN || repsAt(projected, weight) < REP_MIN)) {
    return { weight: rounded, reps: target };
  }

  // Same load: double progression, with a forced jump once past the top.
  const next = Math.round((weight + increment) * 100) / 100;
  const repsAtNext = repsAt(projected, next);
  if (reps >= REP_MAX && (repsAtNext >= REP_MIN - 1 || reps >= REP_MAX + OVERFLOW_REPS)) {
    return { weight: next, reps: clamp(Math.floor(repsAtNext), REP_MIN, target) };
  }
  const cap = reps >= REP_MAX ? REP_MAX + OVERFLOW_REPS : REP_MAX;
  return { weight, reps: Math.min(cap, Math.max(target, reps + 1)) };
}

/**
 * Last session's sets → this session's presets, one per performed set (same
 * count, same set types). A set with no reps was never done (history carries
 * no `completed` flag, see QA_AUDIT EX-004) and is dropped. Only weighted
 * standard sets are progressed; warm-ups, drop sets, myo-reps, bodyweight and
 * timed sets are carried over as they were.
 */
export function prescribeSession(
  last: LastSet[],
  opts: { weighted: boolean; increment: number; daysSince: number },
): Prescription[] {
  const decay = gapDecay(opts.daysSince);
  return last
    .filter((s) => s.actual_reps !== null)
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => {
      const base = { set_type: s.set_type, weight: s.actual_weight, reps: s.actual_reps };
      if (!opts.weighted || s.set_type !== "standard" || !s.actual_weight || !s.actual_reps) return base;
      return { ...base, ...prescribeSet(s.actual_weight, s.actual_reps, s.actual_rir, opts.increment, decay) };
    });
}
