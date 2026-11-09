"use client";

import { debounce } from "@/lib/debounce";
import {
  loadSummary,
  plateCounts,
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

/** Size reads from height and thickness; colours are the standard competition ones. */
const PLATE_LOOK: Record<number, { height: number; width: number; color: string }> = {
  20: { height: 44, width: 9, color: "#1f6fd6" },
  10: { height: 36, width: 8, color: "#1f9d4d" },
  5: { height: 28, width: 6, color: "#f4f4f5" },
  2.5: { height: 22, width: 5, color: "#d7263d" },
  1.25: { height: 16, width: 4, color: "#a1a1aa" },
};

/** What fits on the bar beside the legend; the legend still counts them all. */
const MAX_DRAWN_PLATES = 11;

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
 * One side of the bar: the real one is symmetrical, so drawing both would only
 * take room from the legend. Keyed by plate, not by weight, so a change only
 * touches the plates that differ, and each slides along the bar from its open
 * end. `initial={false}`: opening the keypad doesn't replay the loading.
 */
const Plates = memo(function Plates({ plates }: { plates: number[] }) {
  const reduceMotion = useReducedMotion();
  const drawn = plates.slice(0, MAX_DRAWN_PLATES);
  const keys = plateKeys(drawn);

  return (
    <div className="relative flex items-center gap-px">
      <AnimatePresence initial={false} mode="popLayout">
        {drawn.map((plate, i) => (
          <motion.span
            key={keys[i]}
            layout="position"
            initial={{ x: 12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{
              x: 12,
              opacity: 0,
              transition: reduceMotion ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT },
            }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
            data-plate={plate}
            style={{
              height: PLATE_LOOK[plate].height,
              width: PLATE_LOOK[plate].width,
              backgroundColor: PLATE_LOOK[plate].color,
            }}
            className="block shrink-0 rounded-[2px] border border-black/20"
          />
        ))}
      </AnimatePresence>
    </div>
  );
});

/**
 * Text is what carries the configuration: the colours only tie it to the drawing.
 * Fixed columns and no position animation: entries never travel, since a row
 * sliding across its neighbour mid-change reads as a glitch, not as motion.
 */
const Legend = memo(function Legend({ plates }: { plates: number[] }) {
  const reduceMotion = useReducedMotion();
  const counts = plateCounts(plates);

  return (
    <ul
      aria-label="Plates per side"
      className="grid w-34 shrink-0 grid-flow-col grid-cols-2 gap-x-2 gap-y-0.5"
      style={{ gridTemplateRows: `repeat(${counts.length > 4 ? 3 : 2}, auto)` }}
    >
      <AnimatePresence initial={false}>
        {counts.map(({ plate, count }) => (
          <motion.li
            key={plate}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
            aria-label={`${count} × ${plate} kg`}
            className="tabular flex items-center gap-1.5 text-caption leading-4 font-medium whitespace-nowrap text-label"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px] border border-black/20"
              style={{ backgroundColor: PLATE_LOOK[plate].color }}
            />
            {count} × {plate}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
});

/** Only the new text fades up: crossfading two sums in one spot makes both unreadable. */
function SummaryLine({ text, warn }: { text: string; warn: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <p aria-live="polite" className="flex h-7 items-center overflow-hidden border-t border-separator px-4">
      <motion.span
        key={text}
        data-load-summary
        initial={{ opacity: reduceMotion ? 1 : 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
        className={cn(
          "tabular min-w-0 truncate text-caption",
          warn ? "font-medium text-orange" : "text-label-secondary",
        )}
      >
        {text}
      </motion.span>
    </p>
  );
}

/**
 * The bar and its plates as one persistent object: the keypad keeps a single
 * instance of this mounted for as long as plate-loaded weights are being edited,
 * across sets and exercises, and only the plates, legend and line inside it change.
 */
export function EquipmentLoadPanel({ request }: { request: LoadRequest }) {
  const load = useSettledLoad(request);
  if (!load) return null;
  const summary = loadSummary(load);

  return (
    <div data-load-panel className="border-b border-separator">
      {/* Fixed height, whatever is loaded: the keypad must not move under the finger. */}
      <div className="flex h-14 items-center gap-3 px-4">
        <div role="img" aria-label={summary} className="relative flex h-full min-w-0 flex-1 items-center overflow-hidden">
          <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-pill bg-fill-strong" />
          <span data-frame className="tabular relative shrink-0 rounded-pill bg-fill-strong px-2 py-0.5 text-tab font-semibold text-label">
            {load.frameLabel}
          </span>
          <span className="relative mx-1 h-3.5 w-0.5 shrink-0 rounded-pill bg-label-tertiary" />
          <Plates plates={load.plates} />
        </div>
        <Legend plates={load.plates} />
      </div>
      <SummaryLine text={summary} warn={load.missing > 0 || load.belowBar} />
    </div>
  );
}
