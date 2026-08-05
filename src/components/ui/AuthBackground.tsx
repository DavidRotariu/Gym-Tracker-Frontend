"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Full-viewport ambient backdrop for the auth screens — a single blurred
 * accent blob drifting slowly behind the form, instead of a boxed hero
 * banner. Fixed to the viewport rather than the 480px app column, so it
 * bleeds edge to edge even on wider screens.
 *
 * Motion is slow and continuous, not a snap between two states — a
 * `duration` in the tens of seconds, eased both ways (apple-design §14 also
 * flags looping oscillations near one cycle per ~5s as a vestibular risk;
 * this sits well outside that band). `prefers-reduced-motion` gets the glow
 * with no movement at all, per the same section.
 */
export function AuthBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-background">
      <motion.div
        className="absolute top-[-20%] left-[-10%] size-[85vmax] rounded-full opacity-50 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)",
        }}
        animate={
          reduceMotion
            ? undefined
            : {
                x: ["0%", "40%", "10%", "35%", "0%"],
                y: ["0%", "20%", "45%", "10%", "0%"],
              }
        }
        transition={{ duration: 46, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
