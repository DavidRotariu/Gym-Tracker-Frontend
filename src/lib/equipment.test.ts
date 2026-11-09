import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EQUIPMENT,
  barLoad,
  barLoadSummary,
  formatWeight,
  loadView,
  parseEquipment,
  type BarLoad,
  type EquipmentType,
} from "./equipment.ts";

const bar = (type: EquipmentType, weight: number | null) => loadView(type, weight) as BarLoad;

function assertPerSide(type: EquipmentType, cases: [number, number][]) {
  for (const [total, perSide] of cases) {
    const load = bar(type, total);
    assert.equal(load.perSide, perSide, `${type} ${total} kg`);
    assert.equal(load.missing, 0, `${type} ${total} kg`);
    assert.equal(load.total, total);
  }
}

const BARBELL_CASES: [number, number][] = [[20, 0], [25, 2.5], [30, 5], [40, 10], [50, 15]];

test("20 kg barbell: plates per side", () => {
  assertPerSide("barbell", BARBELL_CASES);
});

test("10 kg EZ bar: plates per side", () => {
  assertPerSide("ez_bar", [[10, 0], [15, 2.5], [20, 5], [30, 10], [40, 15]]);
});

test("Smith machine behaves exactly like the configured 20 kg bar", () => {
  assert.equal(EQUIPMENT.smith_machine.barWeight, 20);
  for (const [total] of BARBELL_CASES) {
    assert.deepEqual(loadView("smith_machine", total), loadView("barbell", total));
  }
});

test("the calculation text matches the spec", () => {
  assert.equal(barLoadSummary(bar("smith_machine", 50)), "15 kg on both sides + 20 kg bar weight = 50 kg");
  assert.equal(barLoadSummary(bar("ez_bar", 30)), "10 kg on both sides + 10 kg bar weight = 30 kg");
  assert.equal(barLoadSummary(bar("ez_bar", 10)), "Empty bar = 10 kg");
});

test("plates break down heaviest first", () => {
  assert.deepEqual(bar("barbell", 50).plates, [15]);
  assert.deepEqual(bar("barbell", 100).plates, [25, 15]);
  assert.deepEqual(bar("barbell", 22.5).plates, [1.25]);
  assert.deepEqual(bar("barbell", 37.5).plates, [5, 2.5, 1.25]);
});

test("fractional totals: exact loads, and the unreachable amount is reported", () => {
  // [total, loaded per side, missing]
  const cases: [number, number, number][] = [
    [21.25, 0, 1.25],
    [22.5, 1.25, 0],
    [23.75, 1.25, 1.25],
    [26.25, 2.5, 1.25],
  ];
  for (const [total, perSide, missing] of cases) {
    const load = bar("barbell", total);
    assert.equal(load.perSide, perSide, `${total} per side`);
    assert.equal(load.missing, missing, `${total} missing`);
    assert.equal(load.total, total, "the entered weight is never rounded");
  }
});

test("weights that aren't multiples of the smallest plate stay float-clean", () => {
  const load = barLoad(20, 20.1);
  assert.equal(load.perSide, 0);
  assert.equal(load.missing, 0.1);
});

test("a total lighter than the bar is flagged, not clamped", () => {
  const load = bar("barbell", 15);
  assert.equal(load.belowBar, true);
  assert.equal(load.total, 15);
  assert.deepEqual(load.plates, []);
  assert.equal(load.missing, 0);
  assert.equal(barLoadSummary(load), "15 kg is less than the 20 kg bar");
});

test("no weight entered shows the empty bar", () => {
  assert.equal(bar("ez_bar", null).total, 10);
  assert.equal(bar("ez_bar", null).perSide, 0);
});

test("machine: no bar is subtracted and the logged weight is preserved", () => {
  assert.equal(EQUIPMENT.machine.barWeight, null);
  assert.deepEqual(loadView("machine", 50), { kind: "selected", weight: 50 });
  assert.equal(formatWeight(50, "machine"), "50 kg");
  assert.equal(loadView("machine", null), null);
});

test("cable: no bar, no loading state, weight shown directly", () => {
  assert.equal(EQUIPMENT.cable.barWeight, null);
  assert.equal(loadView("cable", 30), null);
  assert.equal(formatWeight(30, "cable"), "30 kg");
});

test("dumbbell: one dumbbell, never doubled, no bar, no plates", () => {
  assert.equal(EQUIPMENT.dumbbell.barWeight, null);
  assert.equal(loadView("dumbbell", 30), null);
  assert.equal(formatWeight(30, "dumbbell"), "30 kg / dumbbell");
});

test("equipment comes from the structured field, exact match only", () => {
  assert.equal(parseEquipment("Barbell"), "barbell");
  assert.equal(parseEquipment("EZ Bar"), "ez_bar");
  assert.equal(parseEquipment("ez-bar"), "ez_bar");
  assert.equal(parseEquipment("Curl bar"), "ez_bar");
  assert.equal(parseEquipment("Smith Machine"), "smith_machine");
  assert.equal(parseEquipment(" machine "), "machine");
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
