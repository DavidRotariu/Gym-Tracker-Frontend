"use client";

import { debounce } from "@/lib/debounce";
import {
  loadSummary,
  loadView,
  plateKeys,
  type EquipmentType,
  type PlateLoad,
} from "@/lib/equipment";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { memo, useEffect, useMemo, useState } from "react";

/** Long enough to skip the numbers passed through while typing 50 → 52.5. */
const SETTLE_MS = 150;

/** Height shows size at a glance; colours are the standard competition ones. */
const PLATE_LOOK: Record<number, { height: number; className: string }> = {
  20: { height: 56, className: "bg-[#1f6fd6] text-white" },
  10: { height: 46, className: "bg-[#1f9d4d] text-white" },
  5: { height: 36, className: "bg-[#f4f4f5] text-black" },
  2.5: { height: 28, className: "bg-[#34343a] text-white" },
  1.25: { height: 22, className: "bg-[#a1a1aa] text-black" },
};

/** What fits on a side at 375px; the summary line still states the real load. */
const MAX_DRAWN_PLATES = 8;

function useSettledValue<T>(value: T): T {
  const [settled, setSettled] = useState(value);
  const [settle] = useState(() => debounce(setSettled, SETTLE_MS));
  useEffect(() => settle(value), [settle, value]);
  useEffect(() => settle.cancel, [settle]);
  return settled;
}

/**
 * Keyed by plate, not by weight, so a change only touches the plates that
 * differ. `initial={false}`: opening a field shows what's loaded without
 * replaying it onto the bar.
 */
const Plates = memo(function Plates({
  plates,
  side,
}: {
  plates: number[];
  side: "left" | "right";
}) {
  const reduceMotion = useReducedMotion();
  const drawn = plates.slice(0, MAX_DRAWN_PLATES);
  const keys = plateKeys(drawn);
  const hidden = plates.length - drawn.length;
  // Heaviest sits against the collar, in the middle of the drawing.
  const items = drawn.map((plate, i) => ({ plate, key: keys[i] }));
  if (side === "left") items.reverse();
  const offstage = { x: side === "left" ? -8 : 8, opacity: 0 };

  return (
    <div
      className={cn(
        "relative flex items-center gap-px",
        side === "left" ? "flex-row justify-end" : "flex-row justify-start",
      )}
    >
      {hidden > 0 && side === "left" && <MorePlates count={hidden} />}
      <AnimatePresence initial={false} mode="popLayout">
        {items.map(({ plate, key }) => (
          <motion.span
            key={key}
            layout="position"
            initial={offstage}
            animate={{ x: 0, opacity: 1 }}
            exit={offstage}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            style={{ height: PLATE_LOOK[plate].height }}
            className={cn(
              "flex w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-black/25",
              "text-[9px] leading-none font-bold tabular-nums [writing-mode:vertical-rl]",
              PLATE_LOOK[plate].className,
            )}
          >
            {plate}
          </motion.span>
        ))}
      </AnimatePresence>
      {hidden > 0 && side === "right" && <MorePlates count={hidden} />}
    </div>
  );
});

function MorePlates({ count }: { count: number }) {
  return <span className="tabular px-0.5 text-tab font-semibold text-label-secondary">+{count}</span>;
}

function PlateLoadView({ load }: { load: PlateLoad }) {
  const summary = loadSummary(load);
  const warn = load.missing > 0 || load.belowBar;

  return (
    <div className="flex flex-col gap-2 border-b border-separator px-4 py-3">
      {/* Fixed height, whatever is loaded: the keypad must not move under the finger. */}
      <div role="img" aria-label={summary} className="relative grid h-14 grid-cols-[1fr_auto_1fr] items-center">
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-fill-strong" />
        <Plates plates={load.plates} side="left" />
        <span className="tabular relative rounded-pill bg-fill-strong px-2 py-0.5 text-tab font-semibold text-label">
          {load.barWeight > 0 ? `${load.barWeight} kg` : "Machine"}
        </span>
        <Plates plates={load.plates} side="right" />
      </div>

      <p
        aria-live="polite"
        className={cn(
          "tabular flex items-center justify-center gap-1.5 text-caption font-medium whitespace-nowrap",
          warn ? "text-orange" : "text-label-secondary",
        )}
      >
        <span className={cn("size-1.5 shrink-0 rounded-pill", warn ? "bg-orange" : "bg-accent")} />
        <span className="truncate">{summary}</span>
      </p>
    </div>
  );
}

/**
 * Sits on top of the keypad while a weight field is being edited. Stays mounted
 * as the number changes and only reads it once typing pauses, so the numbers
 * passed through on the way to the real one never reach the drawing.
 */
export function EquipmentLoadPanel({
  equipment,
  weight,
}: {
  equipment: EquipmentType;
  weight: number | null;
}) {
  const settled = useSettledValue(weight);
  const view = useMemo(() => loadView(equipment, settled), [equipment, settled]);

  if (!view) return null;
  if (view.kind === "plates") return <PlateLoadView load={view} />;
  return (
    <p
      aria-live="polite"
      className="tabular border-b border-separator px-4 py-3 text-center text-caption font-medium whitespace-nowrap text-label-secondary"
    >
      {view.weight} kg on the machine · no bar weight added
    </p>
  );
}
