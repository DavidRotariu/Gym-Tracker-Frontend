"use client";

import { EquipmentLoadPanel, type LoadRequest } from "@/components/workout/EquipmentLoadPanel";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  /** The + and − keys. */
  onStep: (direction: 1 | -1) => void;
  /** What the loading panel shows for this field, so it opens already correct. */
  load: LoadRequest | null;
}

interface KeypadApi {
  activeId: string | null;
  open: (field: ActiveField) => void;
  /** What the loading panel on top of the keypad shows, if anything. */
  setLoad: (load: LoadRequest | null) => void;
  /** Whether the keypad was last put away from this field, by its keyboard key. */
  wasDismissedFrom: (id: string) => boolean;
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

const SHOW_WEIGHTS_KEY = "overload_show_weights";

/** A display preference, so it fails open: storage trouble just means showing it. */
function readShowWeights(): boolean {
  try {
    return localStorage.getItem(SHOW_WEIGHTS_KEY) !== "false";
  } catch {
    return true;
  }
}

const SIDE_KEY = "flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-control bg-fill text-label-secondary active:opacity-60";

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
  const [load, setLoad] = useState<LoadRequest | null>(null);
  // Only read inside the keypad, which never renders on the server.
  const [showWeights, setShowWeights] = useState(() =>
    typeof window === "undefined" ? true : readShowWeights(),
  );
  const dismissedFromRef = useRef<string | null>(null);
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
    setLoad(null);
  }, []);

  const open =useCallback<KeypadApi["open"]>((next) => {
    if (fieldRef.current && fieldRef.current.id !== next.id) {
      fieldRef.current.onCommit();
    }
    dismissedFromRef.current = null;
    fieldRef.current = next;
    setField(next);
    setLoad(next.load);
  }, []);

  const wasDismissedFrom = useCallback((id: string) => dismissedFromRef.current === id, []);

  const dismiss = useCallback(() => {
    const id = fieldRef.current?.id ?? null;
    close();
    dismissedFromRef.current = id;
  }, [close]);

  // On to the next field in this exercise (weight → reps → next set's weight),
  // or put the keypad away at the end. Opening it commits this one on the way.
  const goNext = useCallback(() => {
    const current = fieldRef.current?.target;
    const fields = [...(current?.closest(".exercise-card")?.querySelectorAll<HTMLElement>("[data-keypad-field]") ?? [])]
      .filter((el) => !el.closest(".pointer-events-none"));
    const next = current ? fields[fields.indexOf(current) + 1] : undefined;
    if (next) next.click();
    else close();
  }, [close]);

  function toggleWeights() {
    const next = !showWeights;
    setShowWeights(next);
    try {
      localStorage.setItem(SHOW_WEIGHTS_KEY, String(next));
    } catch {
      // Still applies for this session.
    }
  }

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
    // The panel changes height when moving to or from equipment without plates.
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

  // Memoised so a weight change only re-renders the panel below, not every
  // number field in the workout.
  const activeFieldId = field?.id ?? null;
  const api = useMemo(
    () => ({ activeId: activeFieldId, open, setLoad, wasDismissedFrom }),
    [activeFieldId, open, wasDismissedFrom],
  );
  const panelVisible = load !== null && showWeights;

  return (
    <KeypadContext.Provider value={api}>
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
                {/* Stays mounted while hidden, so showing it again isn't a rebuild. */}
                <motion.div
                  initial={false}
                  animate={{ height: panelVisible ? "auto" : 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                  aria-hidden={!panelVisible}
                  className="overflow-hidden border-b border-separator"
                >
                  {load && <EquipmentLoadPanel request={load} />}
                </motion.div>
                <div className="flex gap-1.5 p-1.5">
                  <div className="grid min-w-0 flex-1 grid-cols-3">
                    {KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => fieldRef.current?.onKey(key)}
                        disabled={key === "." && field.decimal === false}
                        aria-label={key === "del" ? "Delete" : key}
                        className={cn(
                          "flex h-13 cursor-pointer items-center justify-center rounded-control",
                          "text-2xl font-medium text-label active:bg-fill disabled:text-label-tertiary disabled:opacity-40",
                        )}
                      >
                        {key === "del" ? <BackspaceIcon /> : key}
                      </button>
                    ))}
                  </div>
                  <div className="grid w-24 shrink-0 grid-rows-4 gap-1.5">
                    <button type="button" onClick={dismiss} aria-label="Dismiss keypad" className={SIDE_KEY}>
                      <KeyboardDownIcon />
                    </button>
                    {load ? (
                      <button
                        type="button"
                        onClick={toggleWeights}
                        aria-pressed={showWeights}
                        aria-label={showWeights ? "Hide weights" : "Show weights"}
                        className={cn(SIDE_KEY, "text-caption font-semibold")}
                      >
                        <BarbellIcon />
                        {showWeights ? "Hide" : "Show"}
                      </button>
                    ) : (
                      <span />
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button type="button" onClick={() => fieldRef.current?.onStep(-1)} aria-label="Decrease" className={cn(SIDE_KEY, "text-xl font-medium")}>
                        −
                      </button>
                      <button type="button" onClick={() => fieldRef.current?.onStep(1)} aria-label="Increase" className={cn(SIDE_KEY, "text-xl font-medium")}>
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={goNext}
                      aria-label="Next field"
                      className="flex cursor-pointer items-center justify-center rounded-control bg-label text-background active:opacity-70"
                    >
                      <ArrowIcon />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </KeypadContext.Provider>
  );
}

function KeyboardDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="2.5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 6h.01M8.5 6h.01M11.5 6h.01M14.5 6h.01M6.5 9.3h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.5 15.5 10 18l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarbellIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
      <path d="M1 7h16M4 3v8M7 1.5v11M11 1.5v11M14 3v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden>
      <path d="M2 8h15M11.5 2.5 17 8l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
