"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
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
 * iOS swipe-to-reveal row. Gesture detection comes from react-swipeable; we
 * only translate the row and snap it open or closed. The action still has to
 * be tapped, so a stray swipe never destroys anything.
 */
export function SwipeRow({ actions, children, className, bare }: SwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const openRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const width = actions.length * ACTION_WIDTH;

  const close = () => {
    openRef.current = false;
    setOffset(0);
  };

  const handlers = useSwipeable({
    onSwipeStart: () => setDragging(true),
    onSwiping: (e) => {
      // e.deltaX is negative when swiping left.
      const base = openRef.current ? -width : 0;
      setOffset(Math.min(0, Math.max(base + e.deltaX, -width - 16)));
    },
    onSwiped: (e) => {
      setDragging(false);
      const shouldOpen =
        e.deltaX < -width / 2 || (e.dir === "Left" && e.velocity > 0.4);
      openRef.current = shouldOpen;
      setOffset(shouldOpen ? -width : 0);
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

      <div
        {...handlers}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 260ms cubic-bezier(0.32,0.72,0,1)",
        }}
        className="relative bg-background-secondary"
      >
        {children}
      </div>
    </div>
  );
}
