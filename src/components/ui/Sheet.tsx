"use client";

import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Right-hand header slot, e.g. a "Save" action. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const SPRING = { type: "spring" as const, damping: 34, stiffness: 380, mass: 0.9 };

export function Sheet({
  open,
  onClose,
  title,
  action,
  children,
  className,
}: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "relative flex max-h-[88vh] w-full max-w-[480px] flex-col",
              /* 24px top corners; the one place elevation is used. */
              "rounded-t-sheet bg-background shadow-sheet",
              className,
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={reduceMotion ? { duration: 0.15 } : SPRING}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            {/* Drag handle — the only region that starts a drag, so inner
                content stays scrollable. */}
            <div
              className="shrink-0 cursor-grab touch-none pt-2 pb-1 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="mx-auto h-1 w-9 rounded-pill bg-label-tertiary" />
            </div>

            {(title || action) && (
              <div className="flex shrink-0 items-center justify-between gap-4 px-4 pt-2 pb-3">
                <h2 className="font-display text-stat-sm text-label">{title}</h2>
                {action ?? (
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-label-secondary active:opacity-60"
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M5 5l10 10M15 5L5 15"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}

            <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
