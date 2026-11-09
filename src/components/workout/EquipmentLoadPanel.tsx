"use client";

import { barLoadSummary, type BarLoad, type LoadView } from "@/lib/equipment";
import { motion, useReducedMotion } from "framer-motion";

/** Standard competition plate colours and a height scaled to plate size. */
const PLATE_LOOK: Record<number, { height: number; color: string }> = {
  25: { height: 56, color: "#d7263d" },
  20: { height: 52, color: "#1f6fd6" },
  15: { height: 46, color: "#f2c200" },
  10: { height: 40, color: "#1f9d4d" },
  5: { height: 30, color: "#f4f4f5" },
  2.5: { height: 24, color: "#34343a" },
  1.25: { height: 18, color: "#a1a1aa" },
};

/** Past this the drawing would overflow a phone; the legend still counts them all. */
const MAX_DRAWN_PLATES = 10;

function Plates({ plates, side }: { plates: number[]; side: "left" | "right" }) {
  const reduceMotion = useReducedMotion();
  const drawn = plates.slice(0, MAX_DRAWN_PLATES);
  // Heaviest sits against the collar, in the middle of the drawing.
  const ordered = side === "left" ? [...drawn].reverse() : drawn;
  return (
    <div className={`flex items-center gap-px ${side === "left" ? "justify-end" : "justify-start"}`}>
      {ordered.map((plate, i) => (
        <motion.span
          // Index from the collar, so editing a weight only animates what changed.
          key={`${side === "left" ? ordered.length - i : i}-${plate}`}
          initial={reduceMotion ? false : { scaleY: 0.5, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="block w-2.5 rounded-[3px] border border-black/25"
          style={{ height: PLATE_LOOK[plate].height, backgroundColor: PLATE_LOOK[plate].color }}
        />
      ))}
    </div>
  );
}

function BarLoadView({ load }: { load: BarLoad }) {
  const summary = barLoadSummary(load);
  const counts = [...new Set(load.plates)].map((plate) => ({
    plate,
    count: load.plates.filter((p) => p === plate).length,
  }));

  return (
    <div className="flex flex-col gap-2 border-b border-separator px-4 py-3">
      <div role="img" aria-label={summary} className="relative grid h-14 grid-cols-[1fr_auto_1fr] items-center">
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-fill-strong" />
        <div className="relative">
          <Plates plates={load.plates} side="left" />
        </div>
        <span className="tabular relative rounded-pill bg-fill-strong px-2.5 py-0.5 text-tab font-semibold text-label">
          {load.barWeight} kg
        </span>
        <div className="relative">
          <Plates plates={load.plates} side="right" />
        </div>
      </div>

      {counts.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          {counts.map(({ plate, count }) => (
            <li key={plate} className="tabular flex items-center gap-1 text-caption text-label-secondary">
              <span
                className="size-2.5 rounded-pill border border-black/25"
                style={{ backgroundColor: PLATE_LOOK[plate].color }}
              />
              {plate} kg × {count} / side
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite" className="tabular text-center text-caption">
        <p className="font-medium text-label">{summary}</p>
        {load.missing > 0 && (
          <p className="font-semibold text-orange">
            {load.missing} kg missing for {load.total} kg
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Sits on top of the keypad while a weight field is being edited. Purely a
 * reading of the current draft, so it can't outlive the field or the exercise
 * it belongs to, and it never touches the logged value.
 */
export function EquipmentLoadPanel({ view }: { view: LoadView }) {
  if (view.kind === "bar") return <BarLoadView load={view} />;
  return (
    <p
      aria-live="polite"
      className="tabular border-b border-separator px-4 py-3 text-center text-caption font-medium text-label"
    >
      {view.weight} kg on the machine · no bar weight added
    </p>
  );
}
