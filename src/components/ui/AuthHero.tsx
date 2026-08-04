"use client";

import { motion } from "framer-motion";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

/**
 * The brand moment above the login/signup form. Deliberately always-dark —
 * regardless of the user's light/dark preference — the way Nike/Whoop-style
 * apps keep one fixed brand panel instead of a flat glyph-in-a-box that
 * happens to invert with the theme. Built from gradients and the existing
 * Archivo stat face rather than a stock photo: nothing to license, nothing
 * that looks like everyone else's hero.
 */
export function AuthHero() {
  return (
    <div className="relative -mx-6 mb-8 h-64 overflow-hidden rounded-b-sheet bg-black">
      {/* Debug flare — which data source this build is actually talking to.
          Baked from NEXT_PUBLIC_* at build time, so it reflects the real
          deployed config, not just local dev. Remove once the 503 is
          diagnosed; it's not meant to ship long-term. */}
      <div
        className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-pill bg-black/50 py-1 pr-3 pl-2 backdrop-blur-sm"
        title={USE_MOCKS ? "Using mock data (MSW)" : `Live API: ${BASE_URL || "(no NEXT_PUBLIC_BASE_URL set)"}`}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ background: USE_MOCKS ? "var(--color-green)" : "var(--color-blue)" }}
        />
        <span className="text-tab font-semibold text-white/80 uppercase">
          {USE_MOCKS ? "Mock data" : "Live API"}
        </span>
      </div>

      {/* Accent glow, off-center like a light source rather than a flat
          gradient fill — the thing a generic template skips. */}
      <div
        aria-hidden
        className="absolute -top-24 -right-16 size-72 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-28 -left-20 size-64 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)",
        }}
      />

      {/* Faint hairline grid — texture without reaching for a stock image. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent"
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="relative flex h-full flex-col justify-end gap-1 p-6 pb-7"
      >
        <p className="text-kicker text-white/60 uppercase">Overload</p>
        <h1 className="font-stat text-stat leading-none text-white">
          NO<span style={{ color: "var(--color-accent)" }}>.</span>ZERO
          <br />
          DAYS
        </h1>
      </motion.div>
    </div>
  );
}
