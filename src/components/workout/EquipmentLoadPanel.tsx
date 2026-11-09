"use client";

import { debounce } from "@/lib/debounce";
import {
  loadSummary,
  plateKeys,
  plateLoadFor,
  settleDelay,
  type EquipmentType,
  type PlateLoad,
} from "@/lib/equipment";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { memo, useEffect, useMemo, useState } from "react";

/** What the field being edited wants shown. */
export interface LoadRequest {
  /** The set this is for: weights from a different set show at once, not debounced. */
  sourceKey: string;
  equipment: EquipmentType;
  weight: number | null;
}

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

const EASE_OUT = [0.32, 0.72, 0, 1] as const;

/**
 * Turns the live weight into the configuration to draw. The input updates
 * instantly elsewhere; this only decides when the drawing follows, and it
 * keeps showing the previous configuration until then.
 */
function useSettledLoad({ sourceKey, equipment, weight }: LoadRequest): PlateLoad | null {
  const target = useMemo(() => plateLoadFor(equipment, weight), [equipment, weight]);
  const [shown, setShown] = useState(target);
  const [settle] = useState(() =>
    debounce<PlateLoad | null>(setShown, (load) => (load ? settleDelay(load) : 0)),
  );

  // Another set or exercise isn't a keystroke: follow it right away, adjusted
  // while rendering so its weight never paints under the previous set's plates.
  const source = `${sourceKey}|${equipment}`;
  const [seenSource, setSeenSource] = useState(source);
  if (source !== seenSource) {
    setSeenSource(source);
    setShown(target);
  }

  useEffect(() => settle(target), [settle, target]);
  useEffect(() => settle.cancel, [settle]);
  return shown;
}

/**
 * Keyed by plate, not by weight, so a change only touches the plates that
 * differ. `initial={false}`: opening the keypad shows what's loaded without
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
  // Plates slide along the bar from its open end, as they would by hand.
  const offstage = { x: side === "left" ? -10 : 10, opacity: 0 };
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT };

  return (
    <div className={cn("relative flex items-center gap-px", side === "left" ? "justify-end" : "justify-start")}>
      {hidden > 0 && side === "left" && <MorePlates count={hidden} />}
      <AnimatePresence initial={false} mode="popLayout">
        {items.map(({ plate, key }) => (
          <motion.span
            key={key}
            layout="position"
            initial={offstage}
            animate={{ x: 0, opacity: 1 }}
            exit={offstage}
            transition={transition}
            data-plate
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

/** Old and new text overlap in one grid cell, so swapping them can't move anything. */
function SummaryLine({ text, warn }: { text: string; warn: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <p aria-live="polite" className="grid h-5 place-items-center overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          data-load-summary
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
          className={cn(
            "tabular col-start-1 row-start-1 flex max-w-full items-center gap-1.5 text-caption font-medium whitespace-nowrap",
            warn ? "text-orange" : "text-label-secondary",
          )}
        >
          <span className={cn("size-1.5 shrink-0 rounded-pill", warn ? "bg-orange" : "bg-accent")} />
          <span className="truncate">{text}</span>
        </motion.span>
      </AnimatePresence>
    </p>
  );
}

/**
 * The bar and its plates as one persistent object: the keypad keeps a single
 * instance of this mounted for as long as plate-loaded weights are being edited,
 * across sets and exercises, and only the plates and the line inside it change.
 */
export function EquipmentLoadPanel({ request }: { request: LoadRequest }) {
  const load = useSettledLoad(request);
  if (!load) return null;
  const summary = loadSummary(load);

  return (
    <div data-load-panel className="flex flex-col gap-2 border-b border-separator px-4 py-3">
      {/* Fixed height, whatever is loaded: the keypad must not move under the finger. */}
      <div role="img" aria-label={summary} className="relative grid h-14 grid-cols-[1fr_auto_1fr] items-center">
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-fill-strong" />
        <Plates plates={load.plates} side="left" />
        <span className="tabular relative rounded-pill bg-fill-strong px-2 py-0.5 text-tab font-semibold text-label">
          {load.barWeight > 0 ? `${load.barWeight} kg` : "Machine"}
        </span>
        <Plates plates={load.plates} side="right" />
      </div>
      <SummaryLine text={summary} warn={load.missing > 0 || load.belowBar} />
    </div>
  );
}
