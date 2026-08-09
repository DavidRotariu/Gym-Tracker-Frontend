"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface MediaThumbProps {
  src?: string | null;
  alt: string;
  /** Shown when there's no src, or the file 404s — never a blank box. */
  fallback: React.ReactNode;
  className?: string;
  /**
   * Render a still first frame instead of ever playing. For clips that
   * genuinely never need motion (e.g. a fixed illustration). Anything else
   * — including long lists — can leave this off: playback is gated by
   * on-screen visibility (see below), not by how many cards happen to be
   * mounted.
   */
  static?: boolean;
}

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];

function isVideo(src: string): boolean {
  const path = src.split("?")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Renders whatever `src` is — a local muscle illustration or a cloud-hosted
 * exercise image/video URL (see Exercise.thumbnail_url/video_url in
 * types/index.ts). Local filenames may contain spaces/parentheses, so paths
 * always go through encodeURI. Always degrades to `fallback` instead of a
 * broken-media icon.
 */
export function MediaThumb({
  src,
  alt,
  fallback,
  className,
  static: stillOnly,
}: MediaThumbProps) {
  const [failed, setFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wantsMotion = !stillOnly && !reduceMotion;

  // Play only while the clip is actually on screen, pause the instant it
  // isn't — decoding is driven by the IntersectionObserver, not by whether
  // the element happens to be mounted. That's what lets *every* card in a
  // scrolling list autoplay its video without dozens of off-screen decoders
  // tanking frame rate the way a blanket `autoplay` would.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !wantsMotion) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [wantsMotion]);

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center bg-fill text-label-secondary",
          className,
        )}
      >
        {fallback}
      </span>
    );
  }

  const url = encodeURI(src);

  if (isVideo(src)) {
    return (
      <video
        ref={videoRef}
        key={wantsMotion ? "motion" : "still"}
        src={url}
        loop={wantsMotion}
        muted
        playsInline
        // Off-screen cards in a list (the exercise picker, muscle grids)
        // shouldn't compete for bandwidth with the one actually playing —
        // nothing loads until the IntersectionObserver below calls play().
        preload="none"
        onError={() => setFailed(true)}
        // A long-press meant to trigger our own UI (the exercise picker's
        // preview peek, the drag handle) shouldn't also pop the browser's
        // native "save video"/text-selection callout on top of it.
        className={cn(
          "bg-fill object-cover select-none [-webkit-touch-callout:none]",
          className,
        )}
        aria-label={alt}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      className={cn(
        "bg-fill object-cover select-none [-webkit-touch-callout:none]",
        className,
      )}
    />
  );
}
