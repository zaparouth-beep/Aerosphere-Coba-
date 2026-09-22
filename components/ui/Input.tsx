import { cn } from "@/lib/utils/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-sm text-navy-900 outline-none transition-colors focus:border-navy-700 focus:ring-1 focus:ring-navy-700",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-sm text-navy-900 outline-none transition-colors focus:border-navy-700 focus:ring-1 focus:ring-navy-700",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("mb-1 block text-xs font-medium text-navy-700/80", className)}>
      {children}
    </label>
  );
}
