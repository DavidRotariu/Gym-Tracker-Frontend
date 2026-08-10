import type { Split, WorkoutSession, WorkoutSessionSummary } from "@/types";

/**
 * The API sends muscle names as raw lowercase slugs ("full_body",
 * "upper_back") — this is the one place that turns one into display text,
 * so every screen shows "Full body" instead of the wire format.
 *
 * Guards against null/undefined even though the type says `string`: this
 * runs on live API data crossing a trust boundary, not just our own mock,
 * and a bad/missing muscle name here must not take down the whole
 * GET /exercises response it's embedded in (see formatExercise below).
 */
/**
 * These three are catch-alls, not real muscles someone is browsing for —
 * they always sort to the end of any muscle list/filter, everywhere one is
 * shown. Matches either the raw API slug or the already-formatted display
 * name, so it works whether it's checked before or after formatMuscleName.
 */
const TAIL_MUSCLES = new Set(["cardio", "full_body", "other"]);

export function isTailMuscle(name: string): boolean {
  return TAIL_MUSCLES.has(name.toLowerCase().replace(/ /g, "_"));
}

export function formatMuscleName(name: string | null | undefined): string {
  if (!name) return "";
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Local anatomical illustration for a muscle — always one of the PNGs in
 * public/muscles/, never whatever `Muscle.pic` the API happens to send.
 * Works on either the raw slug ("full_body") or the display name
 * ("Full body") since getMuscles() formats names before anything sees them.
 */
export function muscleImage(name: string | null | undefined): string | null {
  if (!name) return null;
  return `/muscles/${name.toLowerCase().replace(/ /g, "_")}.png`;
}

/** "1h 12m" / "48m" / "—" */
export function formatDuration(
  startedAt: string,
  endedAt: string | null,
): string {
  if (!endedAt) return "—";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Elapsed time as mm:ss / h:mm:ss, for the live session clock. */
export function formatElapsed(startedAt: string, now: number): string {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 1000),
  );
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "Today" / "Yesterday" / "Mon 4 Aug" */
export function formatDay(date: string): string {
  const d = new Date(date);
  const today = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Compact volume: 12.4k kg above 10 000. */
export function formatVolume(kg: number): string {
  if (kg >= 10000) return `${(kg / 1000).toFixed(1)}k`;
  return String(Math.round(kg));
}

export interface SessionStats {
  totalSets: number;
  completedSets: number;
  volume: number;
  exerciseCount: number;
}

export function sessionStats(session: WorkoutSession): SessionStats {
  let totalSets = 0;
  let completedSets = 0;
  let volume = 0;

  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      totalSets += 1;
      if (set.completed) {
        completedSets += 1;
        volume += (set.actual_weight ?? 0) * (set.actual_reps ?? 0);
      }
    }
  }

  return {
    totalSets,
    completedSets,
    volume,
    exerciseCount: session.exercises.length,
  };
}

/**
 * Heaviest completed set per exercise in this session, keyed by exercise_id —
 * used to call out session bests on the finish screen.
 */
export function sessionTopSets(
  session: WorkoutSession,
): Map<string, { weight: number; reps: number }> {
  const best = new Map<string, { weight: number; reps: number }>();
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (!set.completed || set.actual_weight === null) continue;
      const current = best.get(exercise.exercise_id);
      if (!current || set.actual_weight > current.weight) {
        best.set(exercise.exercise_id, {
          weight: set.actual_weight,
          reps: set.actual_reps ?? 0,
        });
      }
    }
  }
  return best;
}

/**
 * "Up next" simply rotates through the user's splits in order — whichever
 * one follows the most recently trained split in the list. A brand-new
 * split, or no history at all, starts the rotation from the top.
 */
export function suggestSplit(
  splits: Split[] | undefined,
  history: WorkoutSessionSummary[] | undefined,
): Split | null {
  if (!splits?.length) return null;

  const lastCompleted = (history ?? [])
    .filter((s) => s.completed_at && s.split_id !== null)
    .sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    )[0];

  if (!lastCompleted) return splits[0];

  const lastIndex = splits.findIndex((s) => s.id === lastCompleted.split_id);
  if (lastIndex === -1) return splits[0];

  return splits[(lastIndex + 1) % splits.length];
}

/** Consecutive days ending today (or yesterday) with a completed workout. */
export function currentStreak(history: WorkoutSessionSummary[] | undefined): number {
  if (!history?.length) return 0;

  const days = new Set<number>();
  for (const session of history) {
    if (!session.completed_at) continue;
    const d = new Date(session.started_at);
    days.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
  }
  if (days.size === 0) return 0;

  const today = new Date();
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // A rest day today shouldn't wipe a streak — start from yesterday if needed.
  if (!days.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
