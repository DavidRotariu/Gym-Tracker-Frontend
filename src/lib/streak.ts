import type { WorkoutSessionSummary } from "@/types";

/**
 * The one streak system. A day is *successful* if it has a completed workout
 * or is a rest day (an explicit date, or a recurring weekday). A streak is a
 * run of successful days that contains at least one workout; a past day that
 * is neither breaks it. Today never breaks it — the day isn't over.
 *
 * Every date here is a local "YYYY-MM-DD" key, matching how the app already
 * buckets sessions into days (local midnight, never UTC).
 */

export interface RestConfig {
  /** Explicit rest dates, "YYYY-MM-DD". */
  dates: ReadonlySet<string>;
  /** Recurring rest weekdays, JS convention: 0 = Sunday … 6 = Saturday. */
  weekdays: ReadonlySet<number>;
}

export const NO_REST: RestConfig = { dates: new Set(), weekdays: new Set() };

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Completed sessions grouped by local start day. Multiple per day = one day. */
export function workoutsByDay(
  history: readonly WorkoutSessionSummary[] | undefined,
): Map<string, WorkoutSessionSummary[]> {
  const map = new Map<string, WorkoutSessionSummary[]>();
  for (const s of history ?? []) {
    if (!s.completed_at) continue;
    const key = dayKey(new Date(s.started_at));
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return map;
}

export function isRestDay(key: string, rest: RestConfig): boolean {
  return rest.dates.has(key) || rest.weekdays.has(parseKey(key).getDay());
}

export type DayKind = "workout" | "rest" | "missed" | "pending" | "future" | "before";

/** "pending" = today with nothing yet; "before" = predates the first workout. */
export function dayKind(
  key: string,
  workouts: ReadonlyMap<string, unknown>,
  rest: RestConfig,
  today: string,
  firstWorkout: string | null,
): DayKind {
  if (key > today) return "future";
  if (workouts.has(key)) return "workout";
  if (isRestDay(key, rest)) return "rest";
  if (key === today) return "pending";
  if (firstWorkout === null || key < firstWorkout) return "before";
  return "missed";
}

export interface StreakStats {
  current: number;
  best: number;
  /** The days making up the current streak, for the calendar's chain. */
  chain: ReadonlySet<string>;
  /** Successful ÷ elapsed days over the last 30, or null with nothing to judge. */
  consistency: number | null;
}

const CONSISTENCY_WINDOW = 30;

export function computeStreaks(
  workouts: ReadonlyMap<string, unknown>,
  rest: RestConfig,
  today: string,
): StreakStats {
  let first: string | null = null;
  for (const k of workouts.keys()) if (k <= today && (first === null || k < first)) first = k;
  if (first === null) return { current: 0, best: 0, chain: new Set(), consistency: null };

  let run: string[] = [];
  let best = 0;
  let judged = 0;
  let ok = 0;
  const windowStart = addDays(today, -(CONSISTENCY_WINDOW - 1));

  for (let k = first; k <= today; k = addDays(k, 1)) {
    const kind = dayKind(k, workouts, rest, today, first);
    if (kind === "workout") run.push(k);
    // Rest keeps a streak alive but can't start one (leading rest is dropped).
    else if (kind === "rest" && run.length) run.push(k);
    else if (kind === "missed") run = [];
    best = Math.max(best, run.length);

    if (k >= windowStart && kind !== "pending") {
      judged += 1;
      if (kind === "workout" || kind === "rest") ok += 1;
    }
  }

  // A run ending in rest days is still a streak, but one that is *only* rest
  // can't exist: runs start at a workout.
  return {
    current: run.length,
    best,
    chain: new Set(run),
    consistency: judged ? Math.round((ok / judged) * 100) : null,
  };
}

/** The first day-count a streak crosses that earns a one-line callout. */
const MILESTONES: [number, string][] = [
  [100, "100 days"],
  [50, "50 days"],
  [30, "30 days of consistency"],
  [14, "Two weeks"],
  [7, "One week strong"],
];

/** Only on the exact milestone day — an occasional moment, not a permanent label. */
export function milestoneFor(streak: number): string | null {
  return MILESTONES.find(([n]) => n === streak)?.[1] ?? null;
}

export function streakCopy(streak: number): string {
  if (streak <= 0) return "Log a workout to start a streak.";
  if (streak === 1) return "Great start.";
  if (streak < 7) return "You're building momentum.";
  if (streak < 14) return "You're on a roll.";
  if (streak < 30) return "Serious consistency.";
  return "You're locked in.";
}
