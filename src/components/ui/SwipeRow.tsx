"use client";

import { cn } from "@/lib/utils";
import { animate, motion, useMotionValue } from "framer-motion";
import { useEffect, useRef } from "react";
import { useSwipeable } from "react-swipeable";

export interface SwipeAction {
  label: string;
  onAction: () => void;
  variant?: "destructive" | "accent" | "neutral";
  icon?: React.ReactNode;
}

interface SwipeRowProps {
  /** Revealed right-to-left, in order. */
  actions: SwipeAction[];
  children: React.ReactNode;
  className?: string;
  /** Skip the rounded-card treatment for use inside a flat list (e.g. a set table row). */
  bare?: boolean;
}

const ACTION_WIDTH = 88;

const actionStyles: Record<NonNullable<SwipeAction["variant"]>, string> = {
  destructive: "bg-red text-white",
  accent: "bg-accent text-accent-foreground",
  neutral: "bg-fill-strong text-label",
};

/**
 * iOS swipe-to-reveal row. Gesture detection comes from react-swipeable —
 * during the drag we write straight to a motion value (1:1 tracking, no
 * animation in the loop), then hand off the release velocity to a spring on
 * release so the settle continues at the finger's speed instead of cutting
 * to a fixed-duration CSS transition (apple-design §3/§5: a velocity-blind
 * settle is exactly the "brick wall" seam that breaks interruptibility).
 * The action still has to be tapped, so a stray swipe never destroys
 * anything.
 */
export function SwipeRow({ actions, children, className, bare }: SwipeRowProps) {
  const x = useMotionValue(0);
  const openRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const width = actions.length * ACTION_WIDTH;

  // Critically damped (no overshoot) — this is a snap-to-position, not a
  // momentum throw, so bounce would read as sloppy rather than physical.
  const settle = (target: number, velocity = 0) =>
    animate(x, target, {
      type: "spring",
      velocity,
      damping: 40,
      stiffness: 420,
      mass: 0.8,
    });

  const close = () => {
    openRef.current = false;
    settle(0);
  };

  const handlers = useSwipeable({
    onSwiping: (e) => {
      // e.deltaX is negative when swiping left.
      const base = openRef.current ? -width : 0;
      x.set(Math.min(0, Math.max(base + e.deltaX, -width - 16)));
    },
    onSwiped: (e) => {
      const shouldOpen =
        e.deltaX < -width / 2 || (e.dir === "Left" && e.velocity > 0.4);
      openRef.current = shouldOpen;
      // vxvy is px/ms — scale to px/s, the unit Motion's spring expects.
      settle(shouldOpen ? -width : 0, e.vxvy[0] * 1000);
    },
    trackMouse: true,
    preventScrollOnSwipe: false,
    delta: 8,
  });

  // A touch anywhere outside this row dismisses it.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!openRef.current) return;
      if (containerRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden",
        !bare && "rounded-card",
        className,
      )}
    >
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
              action.onAction();
            }}
            style={{ width: ACTION_WIDTH }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1",
              "text-caption font-semibold active:opacity-80",
              actionStyles[action.variant ?? "neutral"],
            )}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <motion.div
        {...handlers}
        style={{ x }}
        className="relative bg-background-secondary"
      >
        {children}
      </motion.div>
    </div>
  );
}
