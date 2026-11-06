"use client";

import { MutationCache, onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/Toaster";
import { ViewportFix } from "@/components/ViewportFix";
import { ApiRequestError } from "@/lib/api/client";
import { showToast } from "@/lib/toast";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const queryClient = new QueryClient({
  // The one place a failed write is reported. It runs for every mutation
  // regardless of which screen started it, so a save that fails after the
  // user navigated away still says so (a per-call .catch on the screen would
  // have been unmounted by then). A mutation opts in with meta.failure — the
  // "what happened to my change" half of the message; the error supplies why.
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      const what = mutation.meta?.failure;
      if (typeof what !== "string") return;
      const why = error instanceof Error && error.message ? error.message : "Try again.";
      showToast(`${what} ${why}`);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Offline, a query with nothing cached used to *pause* (never fetch, never
      // fail), which pages render as "No workouts yet" / an empty list — a lie.
      // offlineFirst tries anyway, so a dead connection becomes a real error the
      // screen can explain, while cached data still shows. (Mutations keep the
      // default: they pause offline and sync on reconnect.)
      networkMode: "offlineFirst",
      // One retry for flaky signal — but a 4xx (gone, not allowed) won't
      // change on retry, and retrying it only delays the error screen.
      // And no retry while offline: offlineFirst would *pause* the retry, leaving
      // the query neither loading nor failed — i.e. an empty-looking screen.
      retry: (failureCount, error) =>
        failureCount < 1 &&
        onlineManager.isOnline() &&
        !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500),
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mocksReady, setMocksReady] = useState(!USE_MOCKS);

  useEffect(() => {
    if (!USE_MOCKS) return;
    let cancelled = false;
    import("@/lib/mock/browser").then(({ startWorker }) =>
      startWorker().then(() => {
        if (!cancelled) setMocksReady(true);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemeProvider>
      {/* "user" defers to prefers-reduced-motion automatically — every
          motion.* animation in the app respects it without per-component
          checks. */}
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <ViewportFix />
          <Toaster />
          {mocksReady ? children : null}
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
