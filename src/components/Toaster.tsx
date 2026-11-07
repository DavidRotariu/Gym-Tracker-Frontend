"use client";

import { dismissToast, getToast, subscribeToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useSyncExternalStore } from "react";

/** Tap to dismiss. Above sheets and the finish summary (z-50). */
export function Toaster() {
  const toast = useSyncExternalStore(subscribeToast, getToast, () => null);
  if (!toast) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] z-[60] mx-auto w-full max-w-[480px] px-4"
    >
      <button
        type="button"
        onClick={dismissToast}
        className={cn(
          "w-full cursor-pointer rounded-control px-4 py-3 text-left text-subhead font-semibold shadow-sheet",
          // Red only for errors; a heads-up that isn't a failure is amber.
          toast.tone === "warning" ? "bg-warning-soft text-warning" : "bg-red-strong text-white",
        )}
      >
        {toast.message}
      </button>
    </div>
  );
}
