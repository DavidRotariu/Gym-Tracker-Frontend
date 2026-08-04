"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const PRESETS = [60, 90, 120, 180];

const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

interface RestTimerProps {
  /** Bump to (re)start the timer — the session screen does this when a set
   *  is marked complete. */
  startSignal: number;
}

export function RestTimer({ startSignal }: RestTimerProps) {
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const reduceMotion = useReducedMotion();

  // Only a *change* of signal starts the clock. Comparing the value (rather
  // than tracking "first render") keeps this idempotent under StrictMode's
  // double-invoked effects, which would otherwise start a timer on mount.
  const lastSignal = useRef(startSignal);
  useEffect(() => {
    if (startSignal === lastSignal.current) return;
    lastSignal.current = startSignal;
    setRemaining(durationRef.current);
    setRunning(true);
  }, [startSignal]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const visible = running || remaining > 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = duration > 0 ? remaining / duration : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          // "Materialize, don't just fade" (apple-design §12) — blur/scale
          // and position move together so the chip reads as a physical
          // piece of glass arriving, not a div whose opacity ticked up.
          initial={{ opacity: 0, y: 16, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.92 }}
          transition={
            reduceMotion
              ? { duration: 0.15 }
              : { type: "spring", stiffness: 340, damping: 28 }
          }
          className={cn(
            "flex items-center gap-2.5 rounded-card bg-background-elevated/95 p-2.5 pr-3",
            "shadow-sheet [backdrop-filter:blur(20px)_saturate(180%)]",
            // Same faint full-perimeter edge as the tab bar pill and the
            // auth hero — one "glass" material language across the app
            // instead of each floating surface inventing its own border.
            "ring-1 ring-black/[0.04] dark:ring-white/[0.08]",
          )}
        >
          {/* Circular progress replaces the old bottom bar — the number and
              its countdown live in one glanceable object instead of two
              separate elements (digits up top, a bar burning down below). */}
          <div className="relative flex size-12 shrink-0 items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
              <circle
                cx="24"
                cy="24"
                r={RING_R}
                fill="none"
                stroke="var(--color-fill)"
                strokeWidth="3.5"
              />
              <circle
                cx="24"
                cy="24"
                r={RING_R}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={(1 - progress) * RING_C}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <span className="tabular absolute font-stat text-[0.7rem] leading-none text-label">
              {mm}:{ss}
            </span>
          </div>

          <div className="flex flex-1 gap-1">
            {PRESETS.map((preset) => (
              <motion.button
                key={preset}
                type="button"
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                onClick={() => {
                  setDuration(preset);
                  setRemaining(preset);
                  setRunning(true);
                }}
                className={cn(
                  "tabular h-11 flex-1 cursor-pointer rounded-control text-caption font-semibold",
                  duration === preset
                    ? "bg-accent text-accent-foreground"
                    : "bg-fill text-label-secondary",
                )}
              >
                {preset}s
              </motion.button>
            ))}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={() => {
              if (running) setRunning(false);
              else {
                if (remaining === 0) setRemaining(duration);
                setRunning(true);
              }
            }}
            aria-label={running ? "Pause rest timer" : "Resume rest timer"}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-fill text-label"
          >
            {running ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M4.5 2v10M9.5 2v10"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path d="M3 1.5 12 7l-9 5.5z" fill="currentColor" />
              </svg>
            )}
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={() => {
              setRunning(false);
              setRemaining(0);
            }}
            aria-label="Dismiss rest timer"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-label-tertiary active:bg-fill"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
