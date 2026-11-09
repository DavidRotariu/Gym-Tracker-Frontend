"use client";

import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type KeypadKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "0" | "del";

interface ActiveField {
  id: string;
  /** The field owns its own draft text and updates it in place — the
   *  keypad has no display of its own to keep in sync. */
  onKey: (key: KeypadKey) => void;
  onCommit: () => void;
  /** The field's own element, so the page can keep it above the keypad. */
  target?: HTMLElement | null;
  /** False for whole-number fields (reps, seconds) — the "." key is disabled. */
  decimal?: boolean;
}

interface KeypadApi {
  activeId: string | null;
  open: (field: ActiveField) => void;
  /** Top of the open keypad, for the active field to portal context into. */
  accessorySlot: HTMLDivElement | null;
}

const KeypadContext = createContext<KeypadApi | null>(null);

/** Every NumberField calls this instead of rendering a real `<input>` — see
 *  NumericKeypadProvider for why. */
export function useNumericKeypad() {
  const ctx = useContext(KeypadContext);
  if (!ctx) {
    throw new Error("useNumericKeypad must be used within NumericKeypadProvider");
  }
  return ctx;
}

const KEYS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

/**
 * One shared keypad for the whole workout session, instead of the OS
 * keyboard the browser would otherwise pop for `inputMode="decimal"`. No
 * backdrop, title, display, or Done button — the field being edited *is*
 * the display (each keypress writes straight into its own button, in
 * place), and the rest of the screen stays fully visible/usable underneath
 * rather than dimming behind a sheet scrim. Tapping anything else — another
 * field, the complete checkbox, anywhere — commits and closes, same as a
 * native keyboard losing focus.
 */
export function NumericKeypadProvider({ children }: { children: React.ReactNode }) {
  const [field, setField] = useState<ActiveField | null>(null);
  // Mutable mirror of `field` so `open()`/the outside-tap handler can flush
  // a commit synchronously without waiting on a state update to land first.
  const fieldRef = useRef<ActiveField | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [accessorySlot, setAccessorySlot] = useState<HTMLDivElement | null>(null);
  const mounted = useMounted();
  const reduceMotion = useReducedMotion();

  const revealField = useCallback(() => {
    const el = fieldRef.current?.target;
    if (!el) return;
    const h = panelRef.current?.offsetHeight ?? 240;
    const r = el.getBoundingClientRect();
    const limit = window.innerHeight - h - 12;
    if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit, behavior: "smooth" });
  }, []);

  const close = useCallback(() => {
    fieldRef.current?.onCommit();
    fieldRef.current = null;
    setField(null);
  }, []);

  const open = useCallback<KeypadApi["open"]>((next) => {
    if (fieldRef.current && fieldRef.current.id !== next.id) {
      fieldRef.current.onCommit();
    }
    fieldRef.current = next;
    setField(next);
  }, []);

  // Tap-outside-to-dismiss: anything that isn't the keypad panel itself
  // commits and closes it. A tap that lands on a *different* number field
  // still closes this one here (pointerdown fires before that field's own
  // click), and that field's click handler then opens fresh right after —
  // switching fields "just works" without any special-casing.
  // The keypad is fixed over the bottom of the screen, so without extra room
  // the lowest sets (and the whole last card) sit permanently underneath it,
  // unreachable by scrolling. Pad the page by the panel's height while open,
  // and nudge the field being edited up into the visible area.
  const isOpen = field !== null;
  useEffect(() => {
    if (!isOpen) return;
    const h = panelRef.current?.offsetHeight ?? 240;
    const body = document.body;
    const prev = body.style.paddingBottom;
    // Opening is instant: the field-into-view scroll below needs the room to
    // already exist, or the browser clamps that scroll to the old page height.
    body.style.transition = "";
    body.style.paddingBottom = `${h}px`;
    // "Open" for the rest of the page (the workout scroll-spy) — cleared the
    // instant it closes, not after the exit animation like the panel itself.
    body.dataset.keypadOpen = "";
    // The panel changes height as a field's accessory comes and goes.
    const panel = panelRef.current;
    const observer = new ResizeObserver(() => {
      if (!panel) return;
      body.style.paddingBottom = `${panel.offsetHeight}px`;
      revealField();
    });
    if (panel) observer.observe(panel);
    return () => {
      observer.disconnect();
      // Closing eases the room away in step with the panel sliding down. Taking
      // it all at once, with the page scrolled to the bottom, shrank the
      // document in one frame and the browser clamped the scroll position —
      // the whole page visibly jumped (NEW-007).
      body.style.transition = "padding-bottom 0.28s cubic-bezier(0.32, 0.72, 0, 1)";
      body.style.paddingBottom = prev;
      delete body.dataset.keypadOpen;
      setTimeout(() => {
        if (!("keypadOpen" in body.dataset)) body.style.transition = "";
      }, 350);
    };
  }, [isOpen, revealField]);
  const activeId = field?.id;
  useEffect(() => {
    if (activeId) revealField();
  }, [activeId, revealField]);

  // A draft only exists in the field until it's committed. Backgrounding the
  // app (iOS may then evict it) or leaving the page must commit it, not drop
  // it — same as tapping elsewhere.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && fieldRef.current) close();
    };
    const onPageHide = () => {
      if (fieldRef.current) close();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      fieldRef.current?.onCommit();
      fieldRef.current = null;
    };
  }, [close]);

  // Outside the panel: the typed value is saved the moment a finger lands
  // (so a tap on ✓ or Finish reads it), but the keypad only *closes* if that
  // press turns out to be a tap. A scroll used to slam it shut on the first
  // touch, making the lower sets impossible to reach while typing. A press
  // on another number field leaves it open — that field's own click
  // switches to it, without a close/reopen flicker.
  useEffect(() => {
    if (!field) return;
    let press: { x: number; y: number; onField: boolean } | null = null;
    function onDown(e: PointerEvent) {
      if (panelRef.current?.contains(e.target as Node)) return;
      fieldRef.current?.onCommit();
      const onField = !!(e.target as Element | null)?.closest?.("[data-keypad-field]");
      press = { x: e.clientX, y: e.clientY, onField };
    }
    function onMove(e: PointerEvent) {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) press = null;
    }
    function onUp() {
      if (press && !press.onField) close();
      press = null;
    }
    // The browser took the gesture over (it became a native scroll).
    function onCancel() {
      press = null;
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
    };
  }, [field, close]);

  return (
    <KeypadContext.Provider value={{ activeId: field?.id ?? null, open, accessorySlot }}>
      {children}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {field && (
              <motion.div
                ref={panelRef}
                data-numeric-keypad
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={
                  reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 34 }
                }
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px]",
                  "border-t border-separator bg-background-elevated pb-[env(safe-area-inset-bottom)]",
                  "shadow-sheet",
                )}
              >
                <div ref={setAccessorySlot} />
                <div className="grid grid-cols-3 gap-px bg-separator">
                  {KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => fieldRef.current?.onKey(key)}
                      disabled={key === "." && field.decimal === false}
                      aria-label={key === "del" ? "Delete" : key}
                      className={cn(
                        "flex h-14 cursor-pointer items-center justify-center bg-background-elevated",
                        "text-2xl font-semibold text-label active:bg-fill disabled:text-label-tertiary disabled:opacity-40",
                      )}
                    >
                      {key === "del" ? <BackspaceIcon /> : key}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </KeypadContext.Provider>
  );
}

function BackspaceIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 22 18" fill="none" aria-hidden>
      <path
        d="M8 1H20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8l-7-8 7-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 6.5l5 5m0-5-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
