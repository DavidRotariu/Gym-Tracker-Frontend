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
  destructive: "bg-red-strong text-white",
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

  // Each gesture is locked to the axis it *started* on. Re-deciding from the
  // running total on every move let a slightly diagonal scroll flip into a
  // swipe mid-gesture and drag the row around.
  const axis = useRef<"x" | "y" | null>(null);
  // Set when this gesture is about the row itself (a swipe, or a tap on an
  // already-open row) — the click it ends with must not reach the contents.
  const swallowClick = useRef(false);

  const handlers = useSwipeable({
    onSwipeStart: (e) => {
      axis.current = e.absX > e.absY ? "x" : "y";
      if (axis.current === "x") swallowClick.current = true;
    },
    onSwiping: (e) => {
      if (axis.current !== "x") return;
      // e.deltaX is negative when swiping left.
      const base = openRef.current ? -width : 0;
      x.set(Math.min(0, Math.max(base + e.deltaX, -width - 16)));
    },
    onSwiped: (e) => {
      const horizontal = axis.current === "x";
      axis.current = null;
      if (!horizontal) return; // a scroll — the row never moved
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
      {/* The revealed row sits behind a transform-driven sibling (the
          motion.div below), which some browsers promote to its own
          compositing layer — the parent's overflow-hidden/border-radius
          clip doesn't reliably reach into that layer, so a square pixel of
          this row's right edge can peek past the card's rounded corner even
          at rest. Rounding this row's own corner to match is what actually
          closes it, regardless of the clipping quirk. This was "that
          border" — not a stray outline, the delete/edit action underneath. */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex overflow-hidden",
          !bare ? "rounded-r-card" : "rounded-r-control",
        )}
      >
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
        // pan-y: vertical scrolling stays native; horizontal is ours.
        className="relative touch-pan-y bg-background-secondary"
        onPointerDownCapture={() => {
          // A tap on an open row closes it — it shouldn't also open the
          // keypad or follow the link the row happens to be shifted over.
          swallowClick.current = openRef.current;
        }}
        onClickCapture={(e) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
          if (openRef.current && x.get() === -width) close();
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
