"use client";

import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useIsPresent,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
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

let scrollLocks = 0;
function lockBodyScroll() {
  if (scrollLocks++ === 0) document.body.style.overflow = "hidden";
}
function unlockBodyScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = "";
}

const SPRING = { type: "spring" as const, damping: 34, stiffness: 380, mass: 0.9 };

/**
 * `exit` carries its own transition as a function of `custom` (the release
 * velocity from a drag-to-dismiss) instead of reading a ref during render —
 * refs are for effects/handlers, not values the render output depends on.
 * `hidden` doubles as both the pre-mount `initial` state (no transition
 * needed there) and the `exit` target, so the entrance spring never
 * inherits a stale velocity left over from a previous dismiss.
 */
function sheetVariants(reduceMotion: boolean | null): Variants {
  return {
    hidden: (velocity: number) => ({
      y: "100%",
      transition: reduceMotion ? { duration: 0.15 } : { ...SPRING, velocity },
    }),
    visible: {
      y: 0,
      transition: reduceMotion ? { duration: 0.15 } : SPRING,
    },
  };
}

export function Sheet({
  open,
  onClose,
  title,
  action,
  children,
  className,
}: SheetProps) {
  const mounted = useMounted();
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();
  // Release velocity from a drag-to-dismiss, handed off to the exit spring
  // so the sheet keeps travelling at the finger's speed instead of the drag
  // cutting to a fresh fixed-velocity animation (apple-design §5 — that cut
  // is the "seam" that makes a dismiss feel like two separate motions).
  // Plain state, not a ref: it's read during render (via `custom`), and the
  // whole subtree unmounts on close — a fresh 0 every time the sheet reopens.
  const [dismissVelocity, setDismissVelocity] = useState(0);


  // Ref-counted lock: with stacked/overlapping sheets, each one restoring "its"
  // previous value could put back "hidden" and leave the page unscrollable.
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [open]);

  // Keyboard/screen-reader behaviour of a modal: focus moves into the sheet when
  // it opens and back to what opened it when it closes; Tab stays inside it;
  // Escape closes it.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    // The dialog mounts with the portal's first render — focus it next frame.
    const raf = requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <PresenceLayer key="sheet" className="fixed inset-0 z-50 flex items-end justify-center">
          <Scrim onClose={onClose} />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={cn(
              "outline-none",
              // % of the fixed container, not dvh: dvh can come out shorter than
              // the screen on iOS (standalone), which left the sheet floating
              // above a black strip at the bottom.
              "relative flex max-h-[88%] w-full max-w-[480px] flex-col",
              /* 24px top corners; the one place elevation is used. */
              "rounded-t-sheet bg-background-elevated shadow-sheet",
              // Skirt: the sheet's own colour continues below its bottom edge,
              // so any gap between the container and the screen edge (home
              // indicator zone) reads as sheet, never as the page's black.
              "after:absolute after:inset-x-0 after:top-full after:h-40 after:bg-background-elevated after:content-['']",
              className,
            )}
            custom={dismissVelocity}
            variants={sheetVariants(reduceMotion)}
            initial="hidden"
            animate="visible"
            exit="hidden"
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) {
                setDismissVelocity(info.velocity.y);
                onClose();
              }
            }}
          >
            {/* Drag handle — the only region that starts a drag, so inner
                content stays scrollable. */}
            <div
              className="shrink-0 cursor-grab touch-none pt-2 pb-1 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="mx-auto h-1 w-9 rounded-pill bg-fill-strong" />
            </div>

            {/* The header drags the sheet too — a 16px grabber alone was too
                small a target to find. touch-none: it's a drag surface, not
                a scroll surface. */}
            {(title || action) && (
              <div
                className="flex shrink-0 touch-none items-center justify-between gap-4 px-4 pt-2 pb-3"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <h2 className="text-title text-label">{title}</h2>
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

            {/* flex-1 only does anything when the sheet itself has a fixed
                height (see ExercisePicker's `h-[88vh]` override) — it's a
                no-op for every other sheet, which stays sized to its
                content as before. */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
              {children}
            </div>
          </motion.div>
        </PresenceLayer>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * The full-screen layer stays mounted for the length of the exit animation.
 * While it does, it must not catch touches: the first tap or scroll after
 * closing a sheet used to land on this invisible layer and do nothing.
 */
export function PresenceLayer({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const isPresent = useIsPresent();
  return (
    <div
      className={className}
      style={{ pointerEvents: isPresent ? undefined : "none" }}
    >
      {children}
    </div>
  );
}

/**
 * Tap-outside-to-close. Only a press that *started* on the scrim counts —
 * on iOS the click synthesized at the end of a long-press or a drag can land
 * on a scrim that appeared under the finger and close what was just opened.
 * touch-none: a drag starting here must not scroll the page behind the sheet.
 */
export function Scrim({ onClose }: { onClose: () => void }) {
  const pressed = useRef(false);
  return (
    <motion.div
      className="absolute inset-0 touch-none bg-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onPointerDown={() => {
        pressed.current = true;
      }}
      onClick={() => {
        if (pressed.current) onClose();
        pressed.current = false;
      }}
      aria-hidden
    />
  );
}
