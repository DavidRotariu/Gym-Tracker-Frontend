"use client";

import { useExercises } from "@/hooks/use-exercises";
import { useMuscles } from "@/hooks/use-muscles";
import { useEffect } from "react";

const PREFETCHED_KEY = "overload_media_prefetched";
const CONCURRENCY = 4;

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/** Cheap, native check — don't spend someone's mobile data warming a cache
 *  they didn't ask to warm. */
function shouldSkip(): boolean {
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return !!conn && (conn.saveData === true || /2g/.test(conn.effectiveType ?? ""));
}

async function prefetchAll(urls: string[]) {
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const url = urls[i++];
      try {
        // `force-cache` means this fetch is the only time the byte cost is
        // ever paid — every later <video>/<img> for the same URL is a local
        // cache hit, as long as the host (the muscle illustrations' own
        // server, or whatever CDN serves exercise media) sends a cacheable
        // response. A host that doesn't is a missed optimization, not a
        // failure — the catch below just lets that URL pay its cost later.
        await fetch(encodeURI(url), { cache: "force-cache" });
      } catch {
        // Best-effort: a miss here just means that clip pays the cost
        // later, on-demand, exactly like before this existed.
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/**
 * Warms the browser's HTTP cache for every muscle illustration and exercise
 * clip right after login, so scrolling or opening the picker later hits a
 * warm local cache instead of a several-hundred-KB fetch on the spot. Runs
 * once per browser session and skips itself on save-data/2G connections.
 */
export function VideoPrefetcher() {
  const { data: muscles } = useMuscles();
  const { data: exercises } = useExercises();

  useEffect(() => {
    if (!muscles || !exercises) return;
    if (sessionStorage.getItem(PREFETCHED_KEY)) return;
    if (shouldSkip()) return;

    const urls = [
      ...muscles.map((m) => m.pic),
      ...exercises.map((e) => e.video_url),
      ...exercises.map((e) => e.image_url),
    ].filter((u): u is string => !!u);
    if (urls.length === 0) return;

    sessionStorage.setItem(PREFETCHED_KEY, "1");

    // Idle priority — let the page the user is actually looking at finish
    // its own requests first; this is background warmth, not a blocker.
    // `timeout` guarantees it still runs even if the main thread never
    // reports truly idle (some browsers/embedders never do) — not
    // available in Safari at all, hence the setTimeout fallback.
    const idle: (cb: () => void) => void =
      "requestIdleCallback" in window
        ? (cb) => requestIdleCallback(cb, { timeout: 5000 })
        : (cb) => setTimeout(cb, 1000);
    idle(() => void prefetchAll(urls));
  }, [muscles, exercises]);

  return null;
}
