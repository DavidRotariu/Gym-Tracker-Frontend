"use client";

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
}

interface KeypadApi {
  activeId: string | null;
  open: (field: ActiveField) => void;
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
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

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
  useEffect(() => {
    if (!field) return;
    function handlePointerDown(e: PointerEvent) {
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [field, close]);

  return (
    <KeypadContext.Provider value={{ activeId: field?.id ?? null, open }}>
      {children}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {field && (
              <motion.div
                ref={panelRef}
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
                <div className="grid grid-cols-3 gap-px bg-separator">
                  {KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => fieldRef.current?.onKey(key)}
                      aria-label={key === "del" ? "Delete" : key}
                      className={cn(
                        "flex h-14 cursor-pointer items-center justify-center bg-background-elevated",
                        "text-2xl font-semibold text-label active:bg-fill",
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
