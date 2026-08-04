import { cn } from "@/lib/utils";

interface StatDisplayProps {
  value: React.ReactNode;
  label: string;
  unit?: string;
  /** "hero" is the big campaign-style number; "compact" fits stat rows. */
  size?: "hero" | "compact";
  /** "onAccent" renders black ink for use on a volt background. */
  tone?: "default" | "onAccent";
  /** Tints the value volt — for the one number on a card that should pop. */
  highlight?: boolean;
  className?: string;
}

/**
 * The Nike brand moment: heavy, tight-leading numbers with an uppercase
 * kicker. Deliberately off the iOS type scale — this is the one place we
 * break it, the way NRC layers campaign type over an iOS shell.
 */
export function StatDisplay({
  value,
  label,
  unit,
  size = "compact",
  tone = "default",
  highlight,
  className,
}: StatDisplayProps) {
  const onAccent = tone === "onAccent";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p
        className={cn(
          "tabular font-stat",
          size === "hero" ? "text-stat" : "text-stat-sm",
          onAccent ? "text-accent-foreground" : highlight ? "text-accent-ink" : "text-label",
        )}
      >
        {value}
        {unit && (
          <span
            className={cn(
              "ml-1 text-caption font-bold",
              onAccent ? "text-accent-foreground/60" : "text-label-tertiary",
            )}
          >
            {unit}
          </span>
        )}
      </p>
      <p
        className={cn(
          "text-kicker uppercase",
          onAccent ? "text-accent-foreground/70" : "text-label-tertiary",
        )}
      >
        {label}
      </p>
    </div>
  );
}
