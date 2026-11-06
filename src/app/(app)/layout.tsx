"use client";

import { TabBar } from "@/components/ui/TabBar";
import { VideoPrefetcher } from "@/components/VideoPrefetcher";
import { useRequireAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireAuth();
  const pathname = usePathname();

  // Every route change starts at the top. Next's own scroll-to-top doesn't
  // reliably win here (the page remounts under a keyed fade, and a long
  // workout page leaves the window scrolled far down — e.g. discarding a
  // workout landed Home mid-scroll and glitching). Runs before paint so
  // there's no visible jump.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  if (loading || !user) return null;

  // The workout session screen is a focused, full-screen task — the tab bar
  // would only invite you to wander off mid-set.
  const immersive = pathname.startsWith("/workout/");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <VideoPrefetcher />
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        className={
          immersive
            ? "flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+96px)]"
            // The tab bar now floats (h-16 pill + 1rem gap above the safe
            // area) instead of docking flush to the bottom edge — content
            // needs to clear that extra air, not just the bar's own height.
            : "flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+104px)]"
        }
      >
        {children}
      </motion.main>
      {!immersive && <TabBar />}
    </div>
  );
}
