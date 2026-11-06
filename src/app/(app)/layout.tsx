"use client";

import { TabBar } from "@/components/ui/TabBar";
import { VideoPrefetcher } from "@/components/VideoPrefetcher";
import { useRequireAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";

/**
 * Each history entry carries its own scroll position (like the browser's
 * native restoration, which the keyed remount below defeats). A brand-new
 * entry has none, so it starts at the top; Back/Forward lands on an entry
 * that has one. Stored in history.state rather than detected from
 * `popstate`, because Next renders the restored page before that event fires.
 */
const SCROLL_KEY = "__overloadScrollY";

function recordScroll() {
  try {
    history.replaceState({ ...history.state, [SCROLL_KEY]: window.scrollY }, "");
  } catch {
    // Safari rate-limits replaceState — losing one position is harmless.
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireAuth();
  const pathname = usePathname();

  // A new navigation starts at the top. Next's own scroll-to-top doesn't
  // reliably win here (the page remounts under a keyed fade, and a long
  // workout page leaves the window scrolled far down — e.g. discarding a
  // workout landed Home mid-scroll and glitching). Runs before paint so
  // there's no visible jump.
  //
  // Back/Forward is different: it returns to where that page was left
  // (mid-workout after peeking at an exercise, partway down History after
  // opening a session) instead of also resetting to the top.
  useEffect(() => {
    history.scrollRestoration = "manual";
    // Recorded on press (every tap that navigates starts with one) and when
    // the app is backgrounded — not on every scroll event, which would hit
    // Safari's replaceState rate limit.
    const onHide = () => {
      if (document.visibilityState === "hidden") recordScroll();
    };
    document.addEventListener("pointerdown", recordScroll, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("pointerdown", recordScroll, { capture: true });
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  useLayoutEffect(() => {
    const saved = (history.state as Record<string, unknown> | null)?.[SCROLL_KEY];
    const target = typeof saved === "number" ? saved : 0;
    window.scrollTo({ top: target, left: 0, behavior: "instant" });
    if (target === 0) return;
    // The page may still be filling in (cached data renders a frame or two
    // later) — keep trying briefly until it's tall enough to scroll there.
    let frames = 0;
    let raf = requestAnimationFrame(function retry() {
      if (window.scrollY >= target - 1 || frames++ > 30) return;
      window.scrollTo({ top: target, left: 0, behavior: "instant" });
      raf = requestAnimationFrame(retry);
    });
    return () => cancelAnimationFrame(raf);
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
