import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800",
  brand: "bg-brand-gradient text-white hover:opacity-95",
  secondary: "border border-sand-300 bg-white text-navy-900 hover:bg-sand-50",
  ghost: "text-navy-800 hover:bg-sand-100",
  danger: "border border-status-danger/30 bg-status-danger/5 text-status-danger hover:bg-status-danger/10",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({ label, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-700/60 transition-colors hover:bg-sand-100 hover:text-navy-900 disabled:opacity-40", className)}
      {...props}
    />
  );
}
