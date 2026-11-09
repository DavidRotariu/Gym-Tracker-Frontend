/**
 * The one place that knows what a logged weight means for each kind of
 * equipment. Everything is derived from the exercise's structured `equipment`
 * field, never from its name, and nothing here changes a stored weight: these
 * functions only describe how to load or read it. No animation or React state
 * lives here; the panel just draws whichever plate configuration it's given.
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
  /** Whether the weight is loaded as plates, and so gets the loading panel. */
  plates: boolean;
  /** Set when the logged weight is for one item rather than the total lifted. */
  perItem?: "dumbbell" | "side";
  /** Header of the logging table's weight column, when plain "Kg" would mislead. */
  columnLabel?: string;
}

export const EQUIPMENT: Record<EquipmentType, EquipmentConfig> = {
  barbell: { label: "Barbell", barWeight: 20, plates: true },
  ez_bar: { label: "EZ Bar", barWeight: 10, plates: true },
  // This gym's Smith bar. Smith machines vary, so this isn't a universal figure.
  smith_machine: { label: "Smith Machine", barWeight: 20, plates: true },
  plate_loaded_machine: {
    label: "Plate-Loaded Machine",
    barWeight: null,
    plates: true,
    perItem: "side",
    columnLabel: "Kg / side",
  },
  // "Machine" is the value already stored in the catalog, so it stays the label.
  machine_stack: { label: "Machine", barWeight: null, plates: false },
  cable: { label: "Cable", barWeight: null, plates: false },
  dumbbell: {
    label: "Dumbbell",
    barWeight: null,
    plates: false,
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
  /** The weight asked for, untouched: a total, or per side if `perSideEntry`. */
  entered: number;
  /** Nothing usable was entered, or it was zero. */
  blank: boolean;
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

/** The plate configuration for a weight, or null if this equipment has no plates. */
export function plateLoadFor(
  type: EquipmentType | null | undefined,
  weight: number | null,
): PlateLoad | null {
  if (!type || !EQUIPMENT[type].plates) return null;
  const config = EQUIPMENT[type];
  const valid = weight !== null && Number.isFinite(weight) && weight >= 0 ? weight : null;
  const barWeight = config.barWeight ?? 0;
  const perSideEntry = config.perItem === "side";
  const entered = valid ?? (perSideEntry ? 0 : barWeight);

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
    entered,
    blank: !valid,
    perSideEntry,
    barWeight,
    plates,
    perSide: perSideG / 1000,
    loaded: loadedG / 1000,
    missing: (perSideEntry ? enteredG - perSideG : Math.max(enteredG, barG) - loadedG) / 1000,
    belowBar: !perSideEntry && enteredG < barG,
  };
}

/** "20 kg × 1 / side", "20 + 5 kg / side", "20 × 2 + 5 kg / side". */
function platesText(plates: number[]): string {
  const sizes = [...new Set(plates)];
  const count = (size: number) => plates.filter((p) => p === size).length;
  if (sizes.length === 1) return `${sizes[0]} kg × ${count(sizes[0])} / side`;
  const parts = sizes.map((size) => (count(size) > 1 ? `${size} × ${count(size)}` : `${size}`));
  return `${parts.join(" + ")} kg / side`;
}

/** What fits on one line at 375px, in characters of the panel's caption text. */
export const SUMMARY_MAX_CHARS = 56;

/**
 * The one-line breakdown: the full sum where it fits, otherwise just the total.
 * Warnings replace it, so the line never needs a second row.
 */
export function loadSummary(load: PlateLoad): string {
  const { entered, perSide, loaded, missing, barWeight, plates } = load;
  if (load.belowBar) return `${entered} kg is less than the ${barWeight} kg bar`;
  if (missing > 0) {
    return load.perSideEntry
      ? `${perSide} kg / side loaded • ${missing} kg / side missing`
      : `${loaded} kg loaded • ${missing} kg missing for ${entered} kg`;
  }
  if (perSide === 0) return barWeight > 0 ? `Empty bar = ${barWeight} kg` : "No plates loaded";

  const short = `${platesText(plates)} • ${loaded} kg total`;
  if (barWeight === 0) return short;
  const full = `${platesText(plates)} • ${perSide} kg each side + ${barWeight} kg bar = ${loaded} kg`;
  return full.length <= SUMMARY_MAX_CHARS ? full : short;
}

/** Long enough to skip digits typed in a burst, short enough not to feel late. */
export const SETTLE_MS = 150;
/** Longer than the gap between taps on a phone, so only a real stop gets here. */
export const SETTLE_UNRESOLVED_MS = 600;

/**
 * How long a weight must stay put before it reaches the drawing. A value that
 * can't be loaded as it stands (the "6" on the way to 60, a cleared field) is
 * almost always someone mid-typing: tearing the plates off for it is the flash
 * this exists to prevent, so it waits until they've actually stopped.
 */
export function settleDelay(load: PlateLoad): number {
  return load.blank || load.belowBar || load.missing > 0 ? SETTLE_UNRESOLVED_MS : SETTLE_MS;
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
