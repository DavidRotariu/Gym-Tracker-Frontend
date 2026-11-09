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
  | "plate_loaded_machine"
  | "machine_stack"
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
  perItem?: "dumbbell" | "side";
  /** Header of the logging table's weight column, when plain "Kg" would mislead. */
  columnLabel?: string;
}

export const EQUIPMENT: Record<EquipmentType, EquipmentConfig> = {
  barbell: { label: "Barbell", barWeight: 20, display: "plates" },
  ez_bar: { label: "EZ Bar", barWeight: 10, display: "plates" },
  // This gym's Smith bar. Smith machines vary, so this isn't a universal figure.
  smith_machine: { label: "Smith Machine", barWeight: 20, display: "plates" },
  plate_loaded_machine: {
    label: "Plate-Loaded Machine",
    barWeight: null,
    display: "plates",
    perItem: "side",
    columnLabel: "Kg / side",
  },
  // "Machine" is the value already stored in the catalog, so it stays the label.
  machine_stack: { label: "Machine", barWeight: null, display: "selected" },
  cable: { label: "Cable", barWeight: null, display: "none" },
  dumbbell: {
    label: "Dumbbell",
    barWeight: null,
    display: "none",
    perItem: "dumbbell",
    columnLabel: "Kg each",
  },
};

/**
 * The plates this gym has, heaviest first. Each size divides the next one up,
 * so taking the heaviest that fits always gives the fewest plates.
 */
export const PLATES_KG = [20, 10, 5, 2.5, 1.25] as const;

const ALIASES = new Map<string, EquipmentType>([
  ["barbell", "barbell"],
  ["ez_bar", "ez_bar"],
  ["curl_bar", "ez_bar"],
  ["smith_machine", "smith_machine"],
  ["smith", "smith_machine"],
  ["plate_loaded_machine", "plate_loaded_machine"],
  ["plate_loaded", "plate_loaded_machine"],
  ["machine", "machine_stack"],
  ["machine_stack", "machine_stack"],
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

/** "50 kg", "25 kg / side" or "30 kg / dumbbell". */
export function formatWeight(
  weight: number | string,
  type: EquipmentType | null | undefined,
): string {
  return `${weight} ${weightUnit(type)}`;
}

export function weightColumnLabel(type: EquipmentType | null | undefined): string {
  return (type && EQUIPMENT[type].columnLabel) || "Kg";
}

/** A half-typed weight field as a number: null for "" or anything unparseable. */
export function parseWeightDraft(draft: string): number | null {
  const trimmed = draft.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export interface PlateLoad {
  kind: "plates";
  /** The weight asked for, untouched: a total, or per side if `perSideEntry`. */
  entered: number;
  perSideEntry: boolean;
  /** 0 when there's no bar. */
  barWeight: number;
  /** One side, heaviest first. */
  plates: number[];
  /** Plate weight actually loaded on each side. */
  perSide: number;
  /** Everything loaded: both sides plus any bar. */
  loaded: number;
  /** How far the plates fall short of `entered`, in the same terms as `entered`. */
  missing: number;
  /** The entered total is lighter than the empty bar. */
  belowBar: boolean;
}

function plateLoad(config: EquipmentConfig, weight: number | null): PlateLoad {
  const barWeight = config.barWeight ?? 0;
  const perSideEntry = config.perItem === "side";
  const entered = weight ?? (perSideEntry ? 0 : barWeight);

  // Whole grams, so fractional plates can't pick up float error.
  const enteredG = Math.round(entered * 1000);
  const barG = Math.round(barWeight * 1000);
  const target = perSideEntry ? enteredG : Math.max(0, (enteredG - barG) / 2);

  const plates: number[] = [];
  let perSideG = 0;
  for (const plate of PLATES_KG) {
    const plateG = plate * 1000;
    while (perSideG + plateG <= target) {
      plates.push(plate);
      perSideG += plateG;
    }
  }

  const loadedG = barG + perSideG * 2;
  return {
    kind: "plates",
    entered,
    perSideEntry,
    barWeight,
    plates,
    perSide: perSideG / 1000,
    loaded: loadedG / 1000,
    missing: (perSideEntry ? enteredG - perSideG : Math.max(enteredG, barG) - loadedG) / 1000,
    belowBar: !perSideEntry && enteredG < barG,
  };
}

/** The one-line breakdown. Short enough by construction to fit a phone's width. */
export function loadSummary(load: PlateLoad): string {
  const { entered, perSide, loaded, missing, barWeight } = load;
  if (load.belowBar) return `${entered} kg is less than the ${barWeight} kg bar`;
  if (missing > 0) {
    return load.perSideEntry
      ? `${perSide} kg / side loaded · ${missing} kg / side missing`
      : `${loaded} kg loaded · ${missing} kg missing for ${entered} kg`;
  }
  if (perSide === 0) return barWeight > 0 ? `Empty bar = ${barWeight} kg` : "No plates loaded";
  return barWeight > 0
    ? `${perSide} kg / side + ${barWeight} kg bar = ${loaded} kg`
    : `${perSide} kg / side = ${loaded} kg total`;
}

/**
 * Stable identity for each plate on a side ("the second 20"), so changing the
 * weight only adds or removes the plates that actually differ.
 */
export function plateKeys(plates: readonly number[]): string[] {
  const seen = new Map<number, number>();
  return plates.map((plate) => {
    const nth = seen.get(plate) ?? 0;
    seen.set(plate, nth + 1);
    return `${plate}-${nth}`;
  });
}

export type LoadView = PlateLoad | { kind: "selected"; weight: number };

/**
 * What the loading panel should show, or null when it shouldn't exist at all.
 * With no valid weight entered, plate-loaded equipment shows up empty so its
 * starting weight is visible.
 */
export function loadView(
  type: EquipmentType | null | undefined,
  weight: number | null,
): LoadView | null {
  if (!type) return null;
  const config = EQUIPMENT[type];
  const valid = weight !== null && Number.isFinite(weight) && weight >= 0 ? weight : null;
  if (config.display === "plates") return plateLoad(config, valid);
  if (config.display === "selected" && valid !== null) return { kind: "selected", weight: valid };
  return null;
}
