import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useId } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const describedBy = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;

    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor={inputId}
          className="text-caption font-medium text-label-secondary"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            "h-12 rounded-control bg-fill px-4 text-body text-label",
            "placeholder:text-label-tertiary",
            "focus:outline-2 focus:outline-offset-0 focus:outline-blue",
            error && "outline-2 outline-red",
            className,
          )}
          {...props}
        />
        {error ? (
          <span id={`${inputId}-error`} className="text-caption text-red">
            {error}
          </span>
        ) : hint ? (
          <span
            id={`${inputId}-hint`}
            className="text-caption text-label-secondary"
          >
            {hint}
          </span>
        ) : null}
      </div>
    );
  },
);
TextField.displayName = "TextField";
