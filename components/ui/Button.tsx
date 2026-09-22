import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800",
  secondary: "bg-sand-100 text-navy-900 hover:bg-sand-200 border border-sand-200",
  ghost: "text-navy-900 hover:bg-sand-100",
  danger: "bg-accent-red/10 text-accent-red hover:bg-accent-red/20",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
