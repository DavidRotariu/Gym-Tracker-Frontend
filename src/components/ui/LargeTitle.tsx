"use client";

import { cn } from "@/lib/utils";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";

interface LargeTitleProps {
  title: string;
  /** Small uppercase line above the title. */
  eyebrow?: string;
  /** Trailing slot in the nav bar. */
  action?: React.ReactNode;
  /** Show a back chevron. `true` goes back in history, a string pushes a route. */
  back?: boolean | string;
  backLabel?: string;
}

/**
 * iOS large title: 34px Bold at scroll-top, handing off to a sticky 17px
 * *Bold* nav title on scroll — same size as body text, just heavier. iOS
 * signals hierarchy with weight, not size.
 */
export function LargeTitle({
  title,
  eyebrow,
  action,
  back,
  backLabel = "Back",
}: LargeTitleProps) {
  const router = useRouter();
  const { scrollY } = useScroll();

  const largeOpacity = useTransform(scrollY, [0, 40], [1, 0]);
  const largeY = useTransform(scrollY, [0, 40], [0, -10]);
  const compactOpacity = useTransform(scrollY, [28, 60], [0, 1]);
  const chromeOpacity = useTransform(scrollY, [12, 52], [0, 1]);

  function goBack() {
    if (typeof back === "string") router.push(back);
    else router.back();
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-30 mx-auto w-full max-w-[480px]",
          "pt-[env(safe-area-inset-top)]",
        )}
      >
        <motion.div
          aria-hidden
          style={{ opacity: chromeOpacity }}
          className="absolute inset-0 border-b border-separator bg-chrome [backdrop-filter:blur(20px)]"
        />
        <div className="relative flex h-11 items-center px-4">
          {back ? (
            <button
              onClick={goBack}
              aria-label={backLabel}
              className="-ml-2 flex h-11 min-w-11 cursor-pointer items-center gap-1 px-2 text-accent-ink active:opacity-60"
            >
              <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
                <path
                  d="M9.5 2 2.5 10l7 8"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-body">{backLabel}</span>
            </button>
          ) : null}

          <motion.span
            style={{ opacity: compactOpacity }}
            className="pointer-events-none absolute inset-x-0 mx-auto max-w-[60%] truncate text-center text-body font-bold text-label"
          >
            {title}
          </motion.span>

          <div className="ml-auto flex items-center">{action}</div>
        </div>
      </div>

      {/* Spacer for the fixed nav bar. */}
      <div className="h-[calc(env(safe-area-inset-top)+2.75rem)]" />

      <motion.div
        style={{ opacity: largeOpacity, y: largeY }}
        className="pt-2 pb-4"
      >
        {eyebrow && (
          <p className="mb-1 text-kicker text-label-tertiary uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-large-title text-label">{title}</h1>
      </motion.div>
    </>
  );
}
