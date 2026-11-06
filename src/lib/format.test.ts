import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_WORKOUT_MS, hasCompletedSets, workoutEndTime } from "./format.ts";
import type { WorkoutSession } from "../types/index.ts";

const set = (completed: boolean, completed_at: string | null = null) =>
  ({ id: "s", completed, completed_at }) as unknown as WorkoutSession["exercises"][number]["sets"][number];

const session = (sets: ReturnType<typeof set>[], started_at: string): WorkoutSession =>
  ({
    id: "1",
    started_at,
    completed_at: null,
    exercises: sets.length ? [{ id: "e", sets }] : [],
  }) as unknown as WorkoutSession;

test("an empty or untouched session has nothing completed", () => {
  assert.equal(hasCompletedSets(session([], "2026-01-01T10:00:00Z")), false);
  assert.equal(hasCompletedSets(session([set(false), set(false)], "2026-01-01T10:00:00Z")), false);
});

test("one completed set is enough to count as a workout", () => {
  assert.equal(hasCompletedSets(session([set(false), set(true, "2026-01-01T10:30:00Z")], "2026-01-01T10:00:00Z")), true);
});

test("a workout past the 3h cap ends at its last completed set, not now", () => {
  const started = "2026-01-01T10:00:00Z";
  const s = session([set(true, "2026-01-01T11:00:00Z"), set(true, "2026-01-01T10:40:00Z")], started);
  const now = new Date(started).getTime() + MAX_WORKOUT_MS + 60_000;
  assert.equal(workoutEndTime(s, now), "2026-01-01T11:00:00.000Z");
});

test("within the cap it ends right now", () => {
  const started = "2026-01-01T10:00:00Z";
  const now = new Date(started).getTime() + 30 * 60_000;
  assert.equal(workoutEndTime(session([], started), now), new Date(now).toISOString());
});
