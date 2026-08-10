"use client";

import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";
import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ActiveField {
  id: string;
  label: string;
  draft: string;
  /** Called once, with the final draft string, whenever this field stops
   *  being the active one — Done tapped, backdrop tapped, or another field
   *  opened while this one was still active (same moment a native input
   *  would fire blur). */
  onCommit: (value: string) => void;
}

interface KeypadApi {
  activeId: string | null;
  open: (field: Omit<ActiveField, "draft"> & { initialValue: string }) => void;
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

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;
const MAX_LENGTH = 6;

/**
 * One shared keypad for the whole workout session, instead of the OS
 * keyboard the browser would otherwise pop for `inputMode="decimal"`. Reuses
 * <Sheet> for the chrome (drag-to-dismiss, backdrop, safe-area) rather than
 * reimplementing a bottom sheet — dismissing it *is* committing, exactly
 * like blurring a real input, so every existing close path (backdrop tap,
 * drag down, Escape) already does the right thing for free.
 */
export function NumericKeypadProvider({ children }: { children: React.ReactNode }) {
  const [field, setField] = useState<ActiveField | null>(null);
  // Mutable mirror of `field` so `open()` can flush the *previous* field's
  // commit synchronously without waiting on a state update to land first.
  const fieldRef = useRef<ActiveField | null>(null);

  const commitAndClear = useCallback(() => {
    fieldRef.current?.onCommit(fieldRef.current.draft);
    fieldRef.current = null;
    setField(null);
  }, []);

  const open = useCallback<KeypadApi["open"]>((next) => {
    // Switching fields without closing first (tap set 2's weight while set
    // 1's is still open) — commit the outgoing one first, same as a native
    // input's blur firing before the next one's focus.
    fieldRef.current?.onCommit(fieldRef.current.draft);
    const opened: ActiveField = { ...next, draft: next.initialValue };
    fieldRef.current = opened;
    setField(opened);
  }, []);

  function press(key: (typeof KEYS)[number]) {
    setField((current) => {
      if (!current) return current;
      let draft = current.draft;
      if (key === "del") draft = draft.slice(0, -1);
      else if (key === "." && draft.includes(".")) return current;
      else if (draft.length >= MAX_LENGTH) return current;
      else draft += key;
      const next = { ...current, draft };
      fieldRef.current = next;
      return next;
    });
  }

  return (
    <KeypadContext.Provider value={{ activeId: field?.id ?? null, open }}>
      {children}
      <Sheet
        open={field !== null}
        onClose={commitAndClear}
        title={field?.label}
        action={
          <button
            type="button"
            onClick={commitAndClear}
            className="min-h-11 cursor-pointer px-2 text-body font-semibold text-accent-ink active:opacity-60"
          >
            Done
          </button>
        }
      >
        {field && (
          <div className="flex flex-col gap-4 pb-2">
            <p className="tabular text-center font-stat text-stat-sm text-label">
              {field.draft || "0"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => press(key)}
                  aria-label={key === "del" ? "Delete" : key}
                  className={cn(
                    "flex h-14 cursor-pointer items-center justify-center rounded-control bg-fill",
                    "text-2xl font-semibold text-label active:bg-fill-strong",
                  )}
                >
                  {key === "del" ? <BackspaceIcon /> : key}
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>
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
