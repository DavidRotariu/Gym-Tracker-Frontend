import { cn } from "@/lib/utils";

/**
 * The one section heading: small uppercase label on the page's left edge —
 * the same line as the large title and its eyebrow, so every screen shares
 * one alignment boundary. Sections are `flex-col gap-2`
 * (label → content) and sit `gap-8` apart on a page.
 */
export function SectionLabel({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  /** Optional trailing link/button ("See all"). */
  action?: React.ReactNode;
  className?: string;
}) {
  const label = <h2 className="text-kicker text-label-tertiary uppercase">{children}</h2>;
  if (!action) return <div className={className}>{label}</div>;
  return (
    <div className={cn("flex items-center justify-between", className)}>
      {label}
      {action}
    </div>
  );
}
