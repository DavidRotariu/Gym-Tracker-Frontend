import type { Variants } from "framer-motion";

/**
 * Shared stagger-in for lists (Home's recent sessions, Splits, History,
 * a workout's exercise cards). `MotionConfig reducedMotion="user"` in
 * providers.tsx handles reduced-motion for these automatically.
 */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 30 },
  },
};
