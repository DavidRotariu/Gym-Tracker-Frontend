"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

interface StepperProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  placeholder?: string;
  /** Hide the visible caption for inline use — the label still names the control. */
  hideLabel?: boolean;
}

const HOLD_DELAY = 350;
const HOLD_INTERVAL = 70;

/**
 * Weight/reps entry. Optimised for speed mid-workout: 44px thumb targets,
 * press-and-hold to run the value up, tap the number to type it.
 */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
  placeholder = "—",
  hideLabel,
}: StepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<{ timeout?: number; interval?: number }>({});

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100)),
    [min, max],
  );

  const nudge = useCallback(
    (direction: 1 | -1) => onChange(clamp((value ?? 0) + direction * step)),
    [clamp, onChange, step, value],
  );

  const stopHold = useCallback(() => {
    window.clearTimeout(timers.current.timeout);
    window.clearInterval(timers.current.interval);
    timers.current = {};
  }, []);

  const startHold = useCallback(
    (direction: 1 | -1) => {
      nudge(direction);
      timers.current.timeout = window.setTimeout(() => {
        timers.current.interval = window.setInterval(
          () => nudge(direction),
          HOLD_INTERVAL,
        );
      }, HOLD_DELAY);
    },
    [nudge],
  );

  useEffect(() => stopHold, [stopHold]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function beginEdit() {
    setDraft(value === null ? "" : String(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const parsed = Number(draft.replace(",", "."));
    if (draft.trim() !== "" && Number.isFinite(parsed)) onChange(clamp(parsed));
  }

  const valueClasses = cn(
    "tabular h-11 min-w-0 flex-1 rounded-control bg-background px-1 text-center text-label",
    hideLabel ? "text-body font-semibold" : "font-stat text-stat-sm",
  );

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {!hideLabel && (
        <span className="text-caption font-medium text-label-secondary">
          {label}
        </span>
      )}
      <div className="flex items-center gap-1 rounded-button bg-fill p-1">
        <HoldButton
          label={`Decrease ${label}`}
          onStart={() => startHold(-1)}
          onStop={stopHold}
        >
          <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M2.5 7h9"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </HoldButton>

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            inputMode="decimal"
            autoFocus
            aria-label={label}
            className={cn(valueClasses, "outline-2 outline-blue")}
          />
        ) : (
          <button
            type="button"
            onClick={beginEdit}
            aria-label={`${label}: ${value ?? "not set"}. Tap to type.`}
            className={cn(valueClasses, "cursor-text active:opacity-60")}
          >
            {value === null ? (
              <span className="text-label-tertiary">{placeholder}</span>
            ) : (
              <>
                {value}
                {suffix && (
                  <span className="text-caption font-medium text-label-tertiary">
                    {suffix}
                  </span>
                )}
              </>
            )}
          </button>
        )}

        <HoldButton
          label={`Increase ${label}`}
          onStart={() => startHold(1)}
          onStop={stopHold}
        >
          <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M7 2.5v9M2.5 7h9"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </HoldButton>
      </div>
    </div>
  );
}

function HoldButton({
  label,
  onStart,
  onStop,
  children,
}: {
  label: string;
  onStart: () => void;
  onStop: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        onStart();
      }}
      onPointerUp={onStop}
      onPointerLeave={onStop}
      onPointerCancel={onStop}
      className={cn(
        "flex size-11 shrink-0 cursor-pointer touch-none items-center justify-center rounded-control",
        "bg-background text-label select-none",
        "active:bg-accent active:text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}
