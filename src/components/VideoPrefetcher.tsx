"use client";

import { useMuscles } from "@/hooks/use-muscles";
import { muscleImage } from "@/lib/format";
import { useEffect } from "react";

const PREFETCHED_KEY = "overload_media_prefetched";
const CONCURRENCY = 4;

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
  type?: string;
}

/** Cheap, native check — don't spend someone's mobile data warming a cache
 *  they didn't ask to warm. */
function shouldSkip(): boolean {
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return (
    !!conn &&
    (conn.saveData === true || /2g/.test(conn.effectiveType ?? "") || conn.type === "cellular")
  );
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
 * Warms the browser's HTTP cache for the (small, app-hosted) muscle
 * illustrations only, once per browser session, and never on save-data / 2G.
 *
 * It used to fetch every exercise video and thumbnail too — the whole
 * catalogue, 4 at a time, right after login, on cellular as well (Safari has
 * no Network Information API to say so), and for videos that were never going
 * to be watched. Exercise media now loads only when a card or row actually
 * scrolls into view (see MediaThumb: preload="none" until visible).
 */
export function VideoPrefetcher() {
  const { data: muscles } = useMuscles();

  useEffect(() => {
    if (!muscles) return;
    if (sessionStorage.getItem(PREFETCHED_KEY)) return;
    if (shouldSkip()) return;

    const urls = muscles.map((m) => muscleImage(m.name)).filter((u): u is string => !!u);
    if (urls.length === 0) return;

    sessionStorage.setItem(PREFETCHED_KEY, "1");

    // Idle priority — let the page the user is actually looking at finish
    // first. The setTimeout fallback is for Safari (no requestIdleCallback).
    const idle: (cb: () => void) => void =
      "requestIdleCallback" in window
        ? (cb) => requestIdleCallback(cb, { timeout: 5000 })
        : (cb) => setTimeout(cb, 1000);
    idle(() => void prefetchAll(urls));
  }, [muscles]);

  return null;
}
