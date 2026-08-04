import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Remove default padding for full-bleed content (lists, images). */
  flush?: boolean;
  /** Lifts the card off the page — the one screen-level card that should
   *  read as "the important one" (e.g. today's suggested workout). */
  raised?: boolean;
}

/**
 * Flat resting state by default: a grouped-background fill with no shadow.
 * `raised` is the one elevation step above it; sheets/modals are the step
 * above that (`shadow-sheet`).
 */
export function Card({ className, flush, raised, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card bg-background-secondary",
        raised && "shadow-raised",
        !flush && "p-4",
        className,
      )}
      {...props}
    />
  );
}

/** iOS inset grouped list: rows divided by hairlines. */
export function CardList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-card bg-background-secondary",
        "divide-y divide-separator",
        className,
      )}
      {...props}
    />
  );
}
