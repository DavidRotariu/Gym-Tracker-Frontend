/**
 * The one place that knows what a logged weight means for each kind of
 * equipment. Everything is derived from the exercise's structured `equipment`
 * field, never from its name, and nothing here changes a stored weight: these
 * functions only describe how to load or read it.
 */
export type EquipmentType =
  | "barbell"
  | "ez_bar"
  | "smith_machine"
  | "machine"
  | "cable"
  | "dumbbell";

interface EquipmentConfig {
  /** Display name, and the canonical value saved in `Exercise.equipment`. */
  label: string;
  /** Empty-bar weight in kg; null when there's no bar to account for. */
  barWeight: number | null;
  /** What the loading panel shows: bar + plates, the plain weight, or nothing. */
  display: "plates" | "selected" | "none";
  /** Set when the logged weight is for one item rather than the total lifted. */
  perItem?: string;
}

export const EQUIPMENT: Record<EquipmentType, EquipmentConfig> = {
  barbell: { label: "Barbell", barWeight: 20, display: "plates" },
  ez_bar: { label: "EZ Bar", barWeight: 10, display: "plates" },
  // This gym's Smith bar. Smith machines vary, so this isn't a universal figure.
  smith_machine: { label: "Smith Machine", barWeight: 20, display: "plates" },
  machine: { label: "Machine", barWeight: null, display: "selected" },
  cable: { label: "Cable", barWeight: null, display: "none" },
  dumbbell: { label: "Dumbbell", barWeight: null, display: "none", perItem: "dumbbell" },
};

/** Plate sizes per side, heaviest first. Single source for the calculator. */
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

const ALIASES = new Map<string, EquipmentType>([
  ["barbell", "barbell"],
  ["ez_bar", "ez_bar"],
  ["curl_bar", "ez_bar"],
  ["smith_machine", "smith_machine"],
  ["smith", "smith_machine"],
  ["machine", "machine"],
  ["cable", "cable"],
  ["dumbbell", "dumbbell"],
]);

/** Exact match on the stored value. Anything else (null, "bench") is unknown
 *  and gets the plain "kg" treatment rather than a guess. */
export function parseEquipment(raw: string | null | undefined): EquipmentType | null {
  if (!raw) return null;
  return ALIASES.get(raw.trim().toLowerCase().replace(/[\s_-]+/g, "_")) ?? null;
}

export function weightUnit(type: EquipmentType | null | undefined): string {
  const perItem = type ? EQUIPMENT[type].perItem : undefined;
  return perItem ? `kg / ${perItem}` : "kg";
}

/** "50 kg", or "30 kg / dumbbell" where the number is for one item. */
export function formatWeight(
  weight: number | string,
  type: EquipmentType | null | undefined,
): string {
  return `${weight} ${weightUnit(type)}`;
}

export interface BarLoad {
  kind: "bar";
  /** The weight asked for, untouched. */
  total: number;
  barWeight: number;
  /** One side, heaviest first. */
  plates: number[];
  /** Plate weight actually loaded on each side. */
  perSide: number;
  /** Total kg that the plates can't reach (both sides combined). */
  missing: number;
  /** The total is lighter than the empty bar. */
  belowBar: boolean;
}

export function barLoad(barWeight: number, total: number): BarLoad {
  // Whole grams, so fractional plates can't pick up float error.
  const totalG = Math.round(total * 1000);
  const barG = Math.round(barWeight * 1000);
  const targetPerSide = Math.max(0, (totalG - barG) / 2);

  const plates: number[] = [];
  let perSideG = 0;
  for (const plate of PLATES_KG) {
    const plateG = plate * 1000;
    while (perSideG + plateG <= targetPerSide) {
      plates.push(plate);
      perSideG += plateG;
    }
  }

  return {
    kind: "bar",
    total,
    barWeight,
    plates,
    perSide: perSideG / 1000,
    missing: (Math.max(totalG, barG) - barG - perSideG * 2) / 1000,
    belowBar: totalG < barG,
  };
}

export function barLoadSummary(load: BarLoad): string {
  if (load.belowBar) return `${load.total} kg is less than the ${load.barWeight} kg bar`;
  const loaded = load.barWeight + load.perSide * 2;
  if (load.perSide === 0) return `Empty bar = ${load.barWeight} kg`;
  return `${load.perSide} kg on both sides + ${load.barWeight} kg bar weight = ${loaded} kg`;
}

export type LoadView = BarLoad | { kind: "selected"; weight: number };

/**
 * What the loading panel should show, or null when it shouldn't exist at all.
 * With no weight entered, a bar is shown empty so its starting weight is visible.
 */
export function loadView(
  type: EquipmentType | null | undefined,
  weight: number | null,
): LoadView | null {
  if (!type) return null;
  const { barWeight, display } = EQUIPMENT[type];
  if (display === "plates" && barWeight !== null) return barLoad(barWeight, weight ?? barWeight);
  if (display === "selected" && weight !== null) return { kind: "selected", weight };
  return null;
}
