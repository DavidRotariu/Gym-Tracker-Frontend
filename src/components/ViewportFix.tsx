"use client";

import { useEffect } from "react";

const isField = (el: Element | null) =>
  !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);

/**
 * iOS (PWA / Safari) sometimes leaves the page shifted after the on-screen
 * keyboard closes — typically right after typing the login password. The
 * visual viewport stays offset, so everything fixed to the bottom (tab bar,
 * primary buttons, sheets) floats ~a keyboard-ish gap above the real screen
 * edge until something forces a re-layout (a scroll). This does that
 * re-layout ourselves: once no field has focus, if the visual viewport is
 * still offset or short, re-assert the current scroll position.
 */
export function ViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;

    const resync = () => {
      if (isField(document.activeElement)) return; // keyboard legitimately up
      const offset = vv ? Math.abs(vv.offsetTop) + (window.innerHeight - vv.height) : 0;
      if (vv && offset < 1 && window.scrollY === 0) return;
      window.scrollTo(window.scrollX, window.scrollY);
      // Some iOS versions ignore a no-op scroll; a 1px nudge and back works.
      if (vv && Math.abs(vv.offsetTop) > 0.5) {
        window.scrollTo(window.scrollX, window.scrollY + 1);
        window.scrollTo(window.scrollX, window.scrollY - 1);
      }
    };

    // The keyboard takes ~300ms to animate away — re-check a few times.
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const afterBlur = () => {
      [60, 350, 800].forEach((ms) => {
        const t = setTimeout(() => {
          timers.delete(t);
          resync();
        }, ms);
        timers.add(t);
      });
    };

    document.addEventListener("focusout", afterBlur);
    vv?.addEventListener("resize", resync);
    window.addEventListener("pageshow", resync);
    document.addEventListener("visibilitychange", resync);
    // Also on first load, e.g. arriving straight from the login redirect.
    afterBlur();
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener("focusout", afterBlur);
      vv?.removeEventListener("resize", resync);
      window.removeEventListener("pageshow", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, []);

  return null;
}
