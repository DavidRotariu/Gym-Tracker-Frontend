import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const variantClasses: Record<Variant, string> = {
  /* Volt is a fill only — black ink always sits on it. */
  primary: "bg-accent text-accent-foreground active:brightness-95",
  secondary: "bg-fill text-label active:opacity-70",
  ghost: "bg-transparent text-accent-ink active:opacity-60",
  destructive: "bg-transparent text-red active:opacity-60",
};

/* Every size clears the 44px minimum tap target. */
const sizeClasses: Record<Size, string> = {
  sm: "h-11 px-4 text-body rounded-button",
  md: "h-12 px-5 text-body rounded-button",
  lg: "h-14 px-6 text-body rounded-button",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", block, type, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(
          // Nike: never regular weight on anything tappable.
          "inline-flex items-center justify-center gap-2 font-semibold",
          "cursor-pointer select-none transition-[transform,filter,opacity] duration-150",
          "active:scale-[0.98] motion-reduce:active:scale-100",
          "disabled:pointer-events-none disabled:opacity-40",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue",
          variantClasses[variant],
          sizeClasses[size],
          block && "w-full",
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
