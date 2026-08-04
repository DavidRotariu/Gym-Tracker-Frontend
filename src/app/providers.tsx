"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mocksReady, setMocksReady] = useState(!USE_MOCKS);

  useEffect(() => {
    if (!USE_MOCKS) return;
    let cancelled = false;
    import("@/lib/mock/browser").then(({ worker }) =>
      worker.start({ onUnhandledRequest: "bypass", quiet: true }).then(() => {
        if (!cancelled) setMocksReady(true);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {mocksReady ? children : null}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
