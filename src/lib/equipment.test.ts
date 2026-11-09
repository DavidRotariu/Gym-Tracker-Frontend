import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { debounce } from "./debounce.ts";
import {
  EQUIPMENT,
  PLATES_KG,
  SETTLE_MS,
  SETTLE_UNRESOLVED_MS,
  formatWeight,
  loadSummary,
  parseEquipment,
  parseWeightDraft,
  plateCounts,
  plateKeys,
  plateLoadFor,
  settleDelay,
  weightColumnLabel,
  weightStep,
  type EquipmentType,
  type PlateLoad,
} from "./equipment.ts";

const load = (type: EquipmentType, weight: number | null) => plateLoadFor(type, weight) as PlateLoad;

/** Per-side weight → plates, shared by every plate-loaded equipment type. */
const PER_SIDE_CASES: [number, number[]][] = [
  [5, [5]],
  [6.25, [5, 1.25]],
  [7.5, [5, 2.5]],
  [10, [10]],
  [12.5, [10, 2.5]],
  [15, [10, 5]],
  [17.5, [10, 5, 2.5]],
  [20, [20]],
  [22.5, [20, 2.5]],
  [25, [20, 5]],
  [27.5, [20, 5, 2.5]],
  [28.75, [20, 5, 2.5, 1.25]],
];

test("the gym's plates are exactly 1.25, 2.5, 5, 10 and 20", () => {
  assert.deepEqual([...PLATES_KG], [20, 10, 5, 2.5, 1.25]);
});

test("Smith and plate-loaded machines: the entered weight is per side, no bar", () => {
  for (const type of ["smith_machine", "plate_loaded_machine"] as const) {
    assert.equal(EQUIPMENT[type].barWeight, null);
    for (const [perSide, plates] of PER_SIDE_CASES) {
      const l = load(type, perSide);
      assert.deepEqual(l.plates, plates, `${type} ${perSide} / side`);
      assert.equal(l.perSide, perSide);
      assert.equal(l.loaded, perSide * 2, "no bar added, both sides counted");
      assert.equal(l.missing, 0);
      assert.equal(l.entered, perSide);
    }
  }
  assert.equal(load("smith_machine", 25).frameLabel, "Smith");
  assert.equal(load("plate_loaded_machine", 25).frameLabel, "Machine");
});

test("barbell: the entered weight is the total, bar included", () => {
  for (const [perSide, plates] of PER_SIDE_CASES) {
    const total = perSide * 2 + 20;
    const l = load("barbell", total);
    assert.deepEqual(l.plates, plates, `${total} total`);
    assert.equal(l.perSide, perSide);
    assert.equal(l.loaded, total);
    assert.equal(l.missing, 0);
  }
  assert.equal(load("barbell", 50).frameLabel, "20 kg");
});

test("the exact totals: 20, 40, 50, 70, 87.5, 95, 97.5 and 100 kg", () => {
  const cases: [number, number[]][] = [
    [20, []],
    [40, [10]],
    [50, [10, 5]],
    [70, [20, 5]],
    [87.5, [20, 10, 2.5, 1.25]],
    [95, [20, 10, 5, 2.5]],
    [97.5, [20, 10, 5, 2.5, 1.25]],
    [100, [20, 20]],
  ];
  for (const [total, plates] of cases) {
    assert.deepEqual(load("barbell", total).plates, plates, `${total}`);
    assert.equal(load("barbell", total).missing, 0);
  }
});

test("EZ bar uses the same logic with its own bar weight", () => {
  for (const [total, perSide] of [[10, 0], [15, 2.5], [20, 5], [30, 10], [40, 15]]) {
    assert.equal(load("ez_bar", total).perSide, perSide);
  }
});

test("the legend lists each plate once, heaviest first, only those in use", () => {
  assert.deepEqual(plateCounts(load("barbell", 87.5).plates), [
    { plate: 20, count: 1 },
    { plate: 10, count: 1 },
    { plate: 2.5, count: 1 },
    { plate: 1.25, count: 1 },
  ]);
  assert.deepEqual(plateCounts(load("barbell", 100).plates), [{ plate: 20, count: 2 }]);
  assert.deepEqual(plateCounts(load("barbell", 20).plates), []);
});

test("the one-line calculation", () => {
  assert.equal(loadSummary(load("barbell", 87.5)), "33.75 kg on both sides + 20 kg bar weight = 87.5 kg");
  assert.equal(loadSummary(load("ez_bar", 30)), "10 kg on both sides + 10 kg bar weight = 30 kg");
  assert.equal(loadSummary(load("smith_machine", 25)), "25 kg on both sides = 50 kg total");
  assert.equal(loadSummary(load("plate_loaded_machine", 25)), "25 kg on both sides = 50 kg total");
  assert.equal(loadSummary(load("ez_bar", 10)), "Empty bar = 10 kg");
  assert.equal(loadSummary(load("barbell", 15)), "15 kg is less than the 20 kg bar");
});

test("the calculation is short enough for one line on a phone, at any weight", () => {
  // 343px at about 6px a character; checked against the real text in the browser.
  for (let weight = 0; weight <= 2000; weight += 1.25) {
    for (const type of ["barbell", "ez_bar", "smith_machine", "plate_loaded_machine"] as const) {
      const text = loadSummary(load(type, weight));
      assert.ok(text.length <= 56, `${type} ${weight}: ${text.length} chars: ${text}`);
    }
  }
});

test("+ and − move by the smallest loadable amount", () => {
  assert.equal(weightStep("barbell"), 2.5);
  assert.equal(weightStep("ez_bar"), 2.5);
  assert.equal(weightStep("smith_machine"), 1.25);
  assert.equal(weightStep("plate_loaded_machine"), 1.25);
  assert.equal(weightStep("cable"), 2.5);
  assert.equal(weightStep(null), 2.5);
  for (const total of [70, 72.5, 75, 77.5, 80]) assert.equal(load("barbell", total).missing, 0);
});

test("impossible loads report what's missing and never touch the entered weight", () => {
  // Total-entry: [total, loaded per side, missing]
  const totals: [number, number, number][] = [
    [21.25, 0, 1.25],
    [22.5, 1.25, 0],
    [23.75, 1.25, 1.25],
    [26.25, 2.5, 1.25],
    [71, 25, 1],
  ];
  for (const [total, perSide, missing] of totals) {
    const l = load("barbell", total);
    assert.equal(l.perSide, perSide, `${total} per side`);
    assert.equal(l.missing, missing, `${total} missing`);
    assert.equal(l.entered, total);
  }
  assert.equal(loadSummary(load("barbell", 71)), "70 kg loaded • 1 kg missing for 71 kg");

  const perSide = load("smith_machine", 26);
  assert.deepEqual(perSide.plates, [20, 5]);
  assert.equal(perSide.missing, 1);
  assert.equal(loadSummary(perSide), "25 kg on both sides loaded • 1 kg / side missing");
});

test("decimals stay float-clean", () => {
  const l = load("barbell", 20.1);
  assert.equal(l.perSide, 0);
  assert.equal(l.missing, 0.1);
  assert.equal(load("plate_loaded_machine", 1.25).loaded, 2.5);
  assert.equal(load("plate_loaded_machine", 3.3).missing, 0.8);
});

test("zero and empty input", () => {
  assert.deepEqual(load("plate_loaded_machine", 0).plates, []);
  assert.equal(loadSummary(load("plate_loaded_machine", 0)), "No plates loaded");
  assert.equal(loadSummary(load("plate_loaded_machine", null)), "No plates loaded");
  assert.equal(load("barbell", null).entered, 20, "an empty bar, not 0 kg");
  assert.equal(load("barbell", 0).belowBar, true);
});

test("invalid input never reaches the calculation", () => {
  for (const draft of ["", "  ", "abc", ".", "1.2.3", "-5"]) {
    assert.equal(parseWeightDraft(draft), null, JSON.stringify(draft));
  }
  assert.equal(parseWeightDraft("52."), 52);
  assert.equal(parseWeightDraft("0."), 0);
  assert.equal(parseWeightDraft("52,5"), 52.5);
  for (const weight of [NaN, Infinity, -5]) {
    assert.deepEqual(load("plate_loaded_machine", weight).plates, []);
    assert.equal(load("plate_loaded_machine", weight).blank, true);
  }
});

test("very large weights still add up", () => {
  const l = load("barbell", 2000);
  assert.equal(l.perSide, 990);
  assert.equal(l.plates.length, 50, "49 × 20 + 10");
  assert.equal(l.missing, 0);
});

test("equipment without plates has no plate configuration at all", () => {
  for (const type of ["cable", "machine_stack", "dumbbell"] as const) {
    assert.equal(EQUIPMENT[type].barWeight, null);
    assert.equal(plateLoadFor(type, 50), null);
    assert.equal(plateLoadFor(type, null), null);
  }
  assert.equal(plateLoadFor(null, 50), null);
});

test("logged weights read as what they mean", () => {
  assert.equal(formatWeight(50, "cable"), "50 kg");
  assert.equal(formatWeight(50, "machine_stack"), "50 kg");
  assert.equal(formatWeight(30, "dumbbell"), "30 kg / dumbbell");
  assert.equal(formatWeight(25, "plate_loaded_machine"), "25 kg / side");
  assert.equal(formatWeight(25, "smith_machine"), "25 kg / side");
  assert.equal(formatWeight(70, "barbell"), "70 kg");
  assert.equal(weightColumnLabel("plate_loaded_machine"), "Kg / side");
  assert.equal(weightColumnLabel("dumbbell"), "Kg each");
  assert.equal(weightColumnLabel("smith_machine"), "Kg / side");
  assert.equal(weightColumnLabel("barbell"), "Kg");
  assert.equal(weightColumnLabel(null), "Kg");
});

test("equipment comes from the structured field, exact match only", () => {
  assert.equal(parseEquipment("Barbell"), "barbell");
  assert.equal(parseEquipment("EZ Bar"), "ez_bar");
  assert.equal(parseEquipment("ez-bar"), "ez_bar");
  assert.equal(parseEquipment("Curl bar"), "ez_bar");
  assert.equal(parseEquipment("Smith Machine"), "smith_machine");
  assert.equal(parseEquipment("plate_loaded_machine"), "plate_loaded_machine");
  assert.equal(parseEquipment(" machine "), "machine_stack", "already-stored values keep working");
  for (const unknown of [null, undefined, "", "bench", "constructor", "Barbell Bench Press"]) {
    assert.equal(parseEquipment(unknown), null);
  }
});

test("every canonical label round-trips through the parser", () => {
  for (const [type, config] of Object.entries(EQUIPMENT)) {
    assert.equal(parseEquipment(config.label), type);
  }
});

test("a weight change keeps the identity of plates that stay on the bar", () => {
  const before = plateKeys(load("barbell", 70).plates);
  const after = plateKeys(load("barbell", 75).plates);
  assert.deepEqual(before, ["20-0", "5-0"]);
  assert.deepEqual(after, ["20-0", "5-0", "2.5-0"], "only the 2.5 is new");
  assert.deepEqual(plateKeys([20, 20]), ["20-0", "20-1"], "repeated plates stay distinct");
});

test("values that can't be loaded yet wait longer than ones that can", () => {
  assert.equal(settleDelay(load("barbell", 60)), SETTLE_MS);
  assert.equal(settleDelay(load("barbell", 20)), SETTLE_MS, "an empty bar is a real answer");
  assert.equal(settleDelay(load("barbell", 6)), SETTLE_UNRESOLVED_MS, "below the bar");
  assert.equal(settleDelay(load("barbell", 22)), SETTLE_UNRESOLVED_MS, "not loadable");
  assert.equal(settleDelay(load("barbell", null)), SETTLE_UNRESOLVED_MS, "field cleared");
  assert.equal(settleDelay(load("plate_loaded_machine", 2)), SETTLE_UNRESOLVED_MS);
  assert.equal(settleDelay(load("plate_loaded_machine", null)), SETTLE_UNRESOLVED_MS);
  assert.ok(SETTLE_MS >= 150 && SETTLE_MS <= 250);
});

/** Types a sequence with a gap between keys; returns what the drawing went through. */
function drawnWhileTyping(type: EquipmentType, start: number, steps: [number | null, number][]) {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const drawn = [load(type, start)];
    const settle = debounce<PlateLoad>((l) => drawn.push(l), settleDelay);
    for (const [weight, gapAfterMs] of steps) {
      settle(load(type, weight));
      mock.timers.tick(gapAfterMs);
    }
    return drawn.map((l) => l.plates);
  } finally {
    mock.timers.reset();
  }
}

test("typing at phone speed never takes the plates off on the way to a number", () => {
  const TAP = 250; // ms between taps: well past the debounce, so it can't hide this.
  const REST = 1000;

  assert.deepEqual(
    drawnWhileTyping("barbell", 50, [[5, TAP], [50, REST]]),
    [[10, 5], [10, 5]],
    "50 → 5 → 50 goes nowhere",
  );
  assert.deepEqual(
    drawnWhileTyping("barbell", 50, [[6, TAP], [60, REST]]),
    [[10, 5], [20]],
    "50 → 6 → 60 never goes through empty",
  );
  assert.deepEqual(
    drawnWhileTyping("barbell", 70, [[1, TAP], [10, TAP], [null, TAP], [2, TAP], [20, REST]]),
    [[20, 5], []],
    "only a real empty bar empties it",
  );
});

test("an unloadable weight still shows once typing has really stopped", () => {
  const drawn = drawnWhileTyping("barbell", 50, [[5, SETTLE_UNRESOLVED_MS]]);
  assert.deepEqual(drawn, [[10, 5], []]);
});

test("a fast burst only settles once, on the final value", () => {
  assert.deepEqual(
    drawnWhileTyping("barbell", 50, [[70, 60], [80, 60], [90, 500]]),
    [[10, 5], [20, 10, 5]],
  );
});
