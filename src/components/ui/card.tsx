import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Remove default padding for full-bleed content (lists, images). */
  flush?: boolean;
}

/**
 * Flat resting state, always: a grouped-background fill, hairline
 * separators for internal dividers, no shadow. Shadow is reserved for
 * sheets and the floating rest timer (`shadow-sheet`) — nothing else lifts.
 */
export function Card({ className, flush, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card bg-background-secondary",
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
