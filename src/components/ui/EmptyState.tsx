import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-pill bg-fill text-label-tertiary">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-body font-semibold text-label">{title}</p>
        {description && (
          <p className="mx-auto max-w-[28ch] text-subhead text-label-secondary">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
