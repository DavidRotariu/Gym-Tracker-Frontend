"use client";

import { dismissToast, getToast, subscribeToast } from "@/lib/toast";
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
        className="w-full cursor-pointer rounded-control bg-red-strong px-3 py-2 text-left text-caption font-semibold text-white shadow-sheet"
      >
        {toast.message}
      </button>
    </div>
  );
}
