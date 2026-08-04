import { cn } from "@/lib/utils";

interface GaugeProps {
  rir: number | null;
  maxRir?: number;
  className?: string;
}

/**
 * Effort gauge: fills toward the accent as RIR approaches 0. At RIR 0
 * (failure) it fills fully — one of the few places volt appears outside a CTA.
 */
export function Gauge({ rir, maxRir = 5, className }: GaugeProps) {
  const known = rir !== null;
  const clamped = known ? Math.min(Math.max(rir, 0), maxRir) : maxRir;
  const intensity = known ? 1 - clamped / maxRir : 0;

  return (
    <div
      className={cn("h-1 w-full overflow-hidden rounded-pill bg-fill", className)}
      role="img"
      aria-label={
        known ? `Effort: ${rir} reps in reserve` : "Effort: not logged"
      }
    >
      <div
        className="h-full rounded-pill bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${Math.round(intensity * 100)}%` }}
      />
    </div>
  );
}
