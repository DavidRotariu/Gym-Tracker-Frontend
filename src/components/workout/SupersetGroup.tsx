"use client";

interface SupersetGroupProps {
  children: React.ReactNode;
  onUngroup?: () => void;
}

/**
 * Supersetted exercises are joined by a volt rail down the left — one of the
 * few non-CTA uses of the accent, because the grouping has to read instantly
 * mid-workout.
 */
export function SupersetGroup({ children, onUngroup }: SupersetGroupProps) {
  return (
    <div className="relative pl-4">
      <div
        aria-hidden
        className="absolute top-8 bottom-8 left-0 w-1 rounded-pill bg-accent"
      />
      <div className="mb-2 flex min-h-11 items-center gap-3">
        <span className="text-kicker text-label uppercase">Superset</span>
        {onUngroup && (
          <button
            type="button"
            onClick={onUngroup}
            className="min-h-11 cursor-pointer text-caption font-semibold text-accent-ink active:opacity-60"
          >
            Ungroup
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
