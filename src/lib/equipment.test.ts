import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { debounce } from "./debounce.ts";
import {
  EQUIPMENT,
  PLATES_KG,
  formatWeight,
  loadSummary,
  loadView,
  parseEquipment,
  parseWeightDraft,
  plateKeys,
  weightColumnLabel,
  type EquipmentType,
  type PlateLoad,
} from "./equipment.ts";

const load = (type: EquipmentType, weight: number | null) => loadView(type, weight) as PlateLoad;

/** Per-side weight → plates, shared by every plate-loaded equipment type. */
const PER_SIDE_CASES: [number, number[]][] = [
  [5, [5]],
  [6.25, [5, 1.25]],
  [7.5, [5, 2.5]],
  [12.5, [10, 2.5]],
  [17.5, [10, 5, 2.5]],
  [20, [20]],
  [22.5, [20, 2.5]],
  [25, [20, 5]],
  [27.5, [20, 5, 2.5]],
];

test("the gym's plates are exactly 1.25, 2.5, 5, 10 and 20", () => {
  assert.deepEqual([...PLATES_KG], [20, 10, 5, 2.5, 1.25]);
});

test("plate-loaded machine: the entered weight is per side", () => {
  for (const [perSide, plates] of PER_SIDE_CASES) {
    const l = load("plate_loaded_machine", perSide);
    assert.deepEqual(l.plates, plates, `${perSide} / side`);
    assert.equal(l.perSide, perSide);
    assert.equal(l.loaded, perSide * 2, "no bar added, both sides counted");
    assert.equal(l.missing, 0);
    assert.equal(l.entered, perSide);
  }
});

test("Smith machine: the entered weight is the total, bar included", () => {
  for (const [perSide, plates] of PER_SIDE_CASES) {
    const total = perSide * 2 + 20;
    const l = load("smith_machine", total);
    assert.deepEqual(l.plates, plates, `${total} total`);
    assert.equal(l.perSide, perSide);
    assert.equal(l.loaded, total);
    assert.equal(l.missing, 0);
  }
});

test("Smith 70 → 72.5 → 75 → 77.5 stays loadable with the available plates", () => {
  assert.deepEqual(load("smith_machine", 70).plates, [20, 5]);
  assert.deepEqual(load("smith_machine", 72.5).plates, [20, 5, 1.25]);
  assert.deepEqual(load("smith_machine", 75).plates, [20, 5, 2.5]);
  assert.deepEqual(load("smith_machine", 77.5).plates, [20, 5, 2.5, 1.25]);
});

test("barbell and EZ bar use the same logic with their own bar weights", () => {
  for (const [total, perSide] of [[20, 0], [25, 2.5], [30, 5], [40, 10], [50, 15]]) {
    assert.equal(load("barbell", total).perSide, perSide);
  }
  for (const [total, perSide] of [[10, 0], [15, 2.5], [20, 5], [30, 10], [40, 15]]) {
    assert.equal(load("ez_bar", total).perSide, perSide);
  }
  assert.deepEqual(load("barbell", 50).plates, [10, 5]);
});

test("the one-line breakdown", () => {
  assert.equal(loadSummary(load("smith_machine", 70)), "25 kg / side + 20 kg bar = 70 kg");
  assert.equal(loadSummary(load("plate_loaded_machine", 25)), "25 kg / side = 50 kg total");
  assert.equal(loadSummary(load("ez_bar", 30)), "10 kg / side + 10 kg bar = 30 kg");
  assert.equal(loadSummary(load("ez_bar", 10)), "Empty bar = 10 kg");
  assert.equal(loadSummary(load("smith_machine", 15)), "15 kg is less than the 20 kg bar");
});

test("the breakdown fits one line on a phone, even at silly weights", () => {
  // 343px of text at ~6.5px a character, on a 375px screen.
  const longest = [1999.99, 1998.75, 999.25, 98.75, 71]
    .flatMap((w) => [loadSummary(load("smith_machine", w)), loadSummary(load("plate_loaded_machine", w))])
    .reduce((a, b) => (b.length > a.length ? b : a));
  assert.ok(longest.length <= 52, `${longest.length}: ${longest}`);
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
    const l = load("smith_machine", total);
    assert.equal(l.perSide, perSide, `${total} per side`);
    assert.equal(l.missing, missing, `${total} missing`);
    assert.equal(l.entered, total);
  }
  assert.equal(loadSummary(load("smith_machine", 71)), "70 kg loaded · 1 kg missing for 71 kg");

  const perSide = load("plate_loaded_machine", 26);
  assert.deepEqual(perSide.plates, [20, 5]);
  assert.equal(perSide.missing, 1);
  assert.equal(loadSummary(perSide), "25 kg / side loaded · 1 kg / side missing");
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
  assert.equal(load("smith_machine", null).entered, 20, "an empty bar, not 0 kg");
  assert.equal(load("smith_machine", 0).belowBar, true);
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
    assert.equal(loadView("machine_stack", weight), null);
  }
});

test("very large weights still add up", () => {
  const l = load("smith_machine", 2000);
  assert.equal(l.perSide, 990);
  assert.equal(l.plates.length, 50, "49 × 20 + 10");
  assert.equal(l.missing, 0);
});

test("machine stack: no bar, no plates, logged weight preserved", () => {
  assert.equal(EQUIPMENT.machine_stack.barWeight, null);
  assert.deepEqual(loadView("machine_stack", 50), { kind: "selected", weight: 50 });
  assert.equal(formatWeight(50, "machine_stack"), "50 kg");
  assert.equal(loadView("machine_stack", null), null);
});

test("cable: no bar, no loading state, weight shown directly", () => {
  assert.equal(EQUIPMENT.cable.barWeight, null);
  assert.equal(loadView("cable", 50), null);
  assert.equal(formatWeight(50, "cable"), "50 kg");
});

test("dumbbell: one dumbbell, never doubled, no bar, no plates", () => {
  assert.equal(EQUIPMENT.dumbbell.barWeight, null);
  assert.equal(loadView("dumbbell", 30), null);
  assert.equal(formatWeight(30, "dumbbell"), "30 kg / dumbbell");
});

test("logged weights read as what they mean", () => {
  assert.equal(formatWeight(25, "plate_loaded_machine"), "25 kg / side");
  assert.equal(formatWeight(70, "smith_machine"), "70 kg");
  assert.equal(weightColumnLabel("plate_loaded_machine"), "Kg / side");
  assert.equal(weightColumnLabel("dumbbell"), "Kg each");
  assert.equal(weightColumnLabel("smith_machine"), "Kg");
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
    assert.equal(loadView(parseEquipment(unknown), 50), null);
  }
});

test("every canonical label round-trips through the parser", () => {
  for (const [type, config] of Object.entries(EQUIPMENT)) {
    assert.equal(parseEquipment(config.label), type);
  }
});

test("a weight change keeps the identity of plates that stay on the bar", () => {
  const before = plateKeys(load("smith_machine", 70).plates);
  const after = plateKeys(load("smith_machine", 75).plates);
  assert.deepEqual(before, ["20-0", "5-0"]);
  assert.deepEqual(after, ["20-0", "5-0", "2.5-0"], "only the 2.5 is new");
  assert.deepEqual(plateKeys([20, 20]), ["20-0", "20-1"], "repeated plates stay distinct");
});

test("rapid typing only ever settles once, on the final value", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const settled: string[] = [];
    const type = debounce((v: string) => settled.push(v), 150);

    for (const draft of ["5", "52", "52.", "52.5"]) {
      type(draft);
      mock.timers.tick(60);
    }
    assert.deepEqual(settled, [], "nothing rebuilds mid-typing");

    mock.timers.tick(150);
    assert.deepEqual(settled, ["52.5"]);

    type("55");
    type.cancel();
    mock.timers.tick(500);
    assert.deepEqual(settled, ["52.5"], "closing the field drops a pending update");
  } finally {
    mock.timers.reset();
  }
});
