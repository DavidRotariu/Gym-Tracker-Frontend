"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface MediaThumbProps {
  src?: string | null;
  alt: string;
  /** Shown when there's no src, or the file 404s — never a blank box. */
  fallback: React.ReactNode;
  className?: string;
}

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];

function isVideo(src: string): boolean {
  const path = src.split("?")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Muscle illustrations and exercise clips are a mock-only data extension
 * (see types/index.ts) — filenames may contain spaces/parentheses, so paths
 * always go through encodeURI. Always degrades to `fallback` instead of a
 * broken-media icon.
 */
export function MediaThumb({ src, alt, fallback, className }: MediaThumbProps) {
  const [failed, setFailed] = useState(false);

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
        src={url}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setFailed(true)}
        className={cn("bg-fill object-cover", className)}
        aria-label={alt}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      className={cn("bg-fill object-cover", className)}
    />
  );
}
