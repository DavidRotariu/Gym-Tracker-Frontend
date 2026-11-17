import assert from "node:assert/strict";
import { test } from "node:test";
import { gapDecay, lastPerformed, prescribeSession, prescribeSet, type LastSet } from "./progression.ts";

// Worked examples from the progressive-overload spec (targets = last reps + 1).
test("prescribeSet follows the spec's worked examples", () => {
  assert.deepEqual(prescribeSet(80, 10, 1, 2.5), { weight: 80, reps: 11 }); // met target → +1 rep
  assert.deepEqual(prescribeSet(80, 12, 1, 2.5), { weight: 82.5, reps: 11 }); // top of range → step up
  assert.deepEqual(prescribeSet(12, 11, 1, 2), { weight: 12, reps: 12 }); // +2 kg is +17% → add a rep
  assert.deepEqual(prescribeSet(100, 6, 0, 2.5), { weight: 92.5, reps: 8 }); // below range → drop load
  assert.deepEqual(prescribeSet(100, 14, 2, 2.5), { weight: 107.5, reps: 12 }); // too light → bigger jump
  assert.deepEqual(prescribeSet(8, 12, 1, 2), { weight: 8, reps: 13 }); // overflow one rep
  assert.deepEqual(prescribeSet(8, 13, 1, 2), { weight: 10, reps: 8 }); // overflow cap → jump
});

test("spec simulation: one rep a week from 60×8 climbs +5 kg in 10 weeks", () => {
  let cur = { weight: 60, reps: 8 };
  const path: string[] = [];
  for (let i = 0; i < 10; i++) {
    cur = prescribeSet(cur.weight, cur.reps, 1, 2.5);
    path.push(`${cur.weight}x${cur.reps}`);
  }
  // Every week is overload: more load, or same load and more reps.
  assert.equal(path[0], "60x9");
  assert.equal(path.at(-1)?.startsWith("65x"), true);
});

test("every week is overload and stays inside the guardrails", () => {
  for (const inc of [1.25, 2, 2.5, 5]) {
    for (const w of [10, 22, 40, 61, 100, 180]) {
      for (let reps = 1; reps <= 20; reps++) {
        for (const rir of [0, 1, 2, 4, null]) {
          const p = prescribeSet(w, reps, rir, inc);
          const tag = `${w}x${reps} rir ${rir} inc ${inc} → ${p.weight}x${p.reps}`;
          assert.ok(Number.isInteger(p.reps) && p.reps >= 8 && p.reps <= 13, tag);
          assert.ok(p.weight > 0, tag);
          // Weight only drops if last time fell short of the range (or e1RM says so).
          if (p.weight < w) assert.ok(reps < 8 || (rir ?? 1) === 0 || reps + (rir ?? 1) < 10, tag);
          // Same load ⇒ at least one more rep (up to the overflow cap).
          if (p.weight === w && reps < 13) assert.ok(p.reps > reps || p.reps >= 8 && reps < 8, tag);
          // Off-grid weights stay on the lifter's own steps.
          const steps = (p.weight - w) / inc;
          assert.ok(Math.abs(steps - Math.round(steps)) < 1e-6, tag);
        }
      }
    }
  }
});

test("off-grid weights keep their own steps", () => {
  // 22 kg dumbbells with 2.5 kg jumps: never snaps to 22.5 or 20.
  const p = prescribeSet(22, 12, 1, 2.5);
  assert.ok([22, 24.5].includes(p.weight), String(p.weight));
});

const set = (n: number, type: LastSet["set_type"], w: number | null, r: number | null, rir: number | null = 1): LastSet => ({
  set_number: n,
  set_type: type,
  actual_weight: w,
  actual_reps: r,
  actual_rir: rir,
});

test("prescribeSession keeps set count/types and only progresses weighted standard sets", () => {
  const out = prescribeSession(
    [set(2, "standard", 80, 10), set(1, "warmup", 40, 10, null), set(3, "standard", 80, 12), set(4, "myorep", 70, 8, 0)],
    { weighted: true, increment: 2.5, daysSince: 7 },
  );
  assert.deepEqual(out, [
    { set_type: "warmup", weight: 40, reps: 10 },
    { set_type: "standard", weight: 80, reps: 11 },
    { set_type: "standard", weight: 82.5, reps: 11 },
    { set_type: "myorep", weight: 70, reps: 8 },
  ]);
  const bw = prescribeSession([set(1, "standard", null, 10, null)], { weighted: false, increment: 2.5, daysSince: 7 });
  assert.deepEqual(bw, [{ set_type: "standard", weight: null, reps: 10 }]);
});

test("sets never performed last time (no reps) aren't carried over", () => {
  const out = prescribeSession(
    [set(1, "standard", 80, 10), set(2, "standard", null, null), set(3, "standard", 80, null)],
    { weighted: true, increment: 2.5, daysSince: 7 },
  );
  assert.equal(out.length, 1);
  assert.deepEqual(prescribeSession([], { weighted: true, increment: 2.5, daysSince: 7 }), []);
});

test("a layoff never prescribes more load; a bad date changes nothing", () => {
  assert.equal(gapDecay(7), 1);
  assert.equal(gapDecay(20), 0.95);
  assert.equal(gapDecay(60), 0.9);
  assert.equal(gapDecay(Number.NaN), 1);
  assert.ok(prescribeSet(80, 10, 1, 2.5, gapDecay(40)).weight <= 80);
});

test("lastPerformed skips the live workout and sessions where the exercise was skipped", () => {
  const h = (id: string, reps: (number | null)[]) => ({
    workout_session_id: id,
    sets: reps.map((r, i) => set(i + 1, "standard", 50, r)),
  });
  const history = [h("live", [10]), h("skipped", [null, null]), h("done", [null, 9]), h("older", [12])];
  assert.equal(lastPerformed(history, "live")?.workout_session_id, "done");
  assert.equal(lastPerformed([h("skipped", [null])], "live"), undefined);
  assert.equal(lastPerformed(null, "live"), undefined);
});
