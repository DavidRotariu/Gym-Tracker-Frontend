"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const PRESETS = [60, 90, 120, 180];

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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="overflow-hidden rounded-card bg-background-elevated shadow-sheet"
        >
          <div className="flex items-center gap-3 p-3">
            <span className="tabular font-stat text-stat-sm text-label">
              {mm}:{ss}
            </span>

            <div className="flex flex-1 gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
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
                </button>
              ))}
            </div>

            <button
              type="button"
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
            </button>

            <button
              type="button"
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
            </button>
          </div>

          <div className="h-1 bg-fill">
            <div
              className="h-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
