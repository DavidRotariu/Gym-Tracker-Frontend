import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, computeStreaks, dayKind, milestoneFor, workoutsByDay, type RestConfig } from "./streak.ts";

const TODAY = "2026-11-08"; // a Sunday
const W = (...days: string[]) => new Map(days.map((d) => [d, true]));
const rest = (dates: string[] = [], weekdays: number[] = []): RestConfig => ({
  dates: new Set(dates),
  weekdays: new Set(weekdays),
});
const run = (workouts: string[], r = rest(), today = TODAY) => computeStreaks(W(...workouts), r, today);

test("no workouts: zero, calendar still computable", () => {
  const s = run([]);
  assert.deepEqual([s.current, s.best, s.consistency], [0, 0, null]);
});

test("one workout today or yesterday is a 1-day streak", () => {
  assert.equal(run([TODAY]).current, 1);
  assert.equal(run(["2026-11-07"]).current, 1);
});

test("today pending doesn't break the streak; a missed yesterday does", () => {
  assert.equal(run(["2026-11-06", "2026-11-07"]).current, 2);
  assert.equal(run(["2026-11-06"]).current, 0);
});

test("workout, workout, rest, workout, workout = 5", () => {
  const s = run(["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06"], rest(["2026-11-04"]), "2026-11-06");
  assert.equal(s.current, 5);
  assert.equal(s.best, 5);
});

test("a missed day breaks the streak and starts a new one", () => {
  const s = run(["2026-11-02", "2026-11-03", "2026-11-05"], rest(), "2026-11-05");
  assert.deepEqual([s.current, s.best], [1, 2]);
});

test("recurring rest weekday preserves continuity; workout on it still counts", () => {
  // Sun 11-01 is rest by weekday (0); Sat 10-31 and Mon 11-02 worked out.
  assert.equal(run(["2026-10-31", "2026-11-02"], rest([], [0]), "2026-11-02").current, 3);
  assert.equal(dayKind("2026-11-01", W("2026-11-01"), rest([], [0]), TODAY, "2026-10-01"), "workout");
});

test("rest-only never forms a streak, and leading rest isn't counted", () => {
  assert.equal(run([], rest([], [0, 3])).current, 0);
  assert.equal(run([TODAY], rest(["2026-11-06", "2026-11-07"])).current, 1);
});

test("crosses month and year boundaries", () => {
  assert.equal(run(["2026-10-31", "2026-11-01"], rest(), "2026-11-01").current, 2);
  assert.equal(run(["2026-12-31", "2027-01-01"], rest(), "2027-01-01").current, 2);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("future days are never missed; days before the first workout aren't either", () => {
  assert.equal(dayKind("2026-11-20", W(), rest(), TODAY, "2026-11-01"), "future");
  assert.equal(dayKind("2026-10-01", W(), rest(), TODAY, "2026-11-01"), "before");
  assert.equal(dayKind("2026-11-05", W(), rest(), TODAY, "2026-11-01"), "missed");
});

test("removing a rest day re-breaks the streak", () => {
  const w = ["2026-11-02", "2026-11-04"];
  assert.equal(run(w, rest(["2026-11-03"]), "2026-11-04").current, 3);
  assert.equal(run(w, rest(), "2026-11-04").current, 1);
});

test("multiple sessions in a day are one day; unfinished ones are ignored", () => {
  const at = (id: string, started_at: string, completed_at: string | null) =>
    ({ id, started_at, completed_at, split_id: null, notes: null }) as never;
  const m = workoutsByDay([
    at("1", "2026-11-05T10:00:00", "2026-11-05T11:00:00"),
    at("2", "2026-11-05T18:00:00", "2026-11-05T19:00:00"),
    at("3", "2026-11-06T10:00:00", null),
  ]);
  assert.equal(m.size, 1);
  assert.equal(m.get("2026-11-05")?.length, 2);
});

test("consistency counts rest as success, ignores today-pending", () => {
  // 3 judged days (11-05, 11-06, 11-07): workout, rest, missed → 67%
  const s = run(["2026-11-05"], rest(["2026-11-06"]), TODAY);
  assert.equal(s.consistency, 67);
});

test("milestones fire on the exact day only", () => {
  assert.equal(milestoneFor(7), "One week strong");
  assert.equal(milestoneFor(8), null);
});
