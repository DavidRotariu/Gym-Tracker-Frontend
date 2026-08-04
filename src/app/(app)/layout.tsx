"use client";

import { TabBar } from "@/components/ui/TabBar";
import { useRequireAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireAuth();
  const pathname = usePathname();

  if (loading || !user) return null;

  // The workout session screen is a focused, full-screen task — the tab bar
  // would only invite you to wander off mid-set.
  const immersive = pathname.startsWith("/workout/");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        className={
          immersive
            ? "flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+96px)]"
            : "flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+92px)]"
        }
      >
        {children}
      </motion.main>
      {!immersive && <TabBar />}
    </div>
  );
}
