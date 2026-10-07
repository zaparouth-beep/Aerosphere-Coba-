import { cn } from "@/lib/utils/cn";

export function Card({ className, children, id }: { className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn("rounded-xl border border-sand-200 bg-white shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-sand-200 px-5 py-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-teal">{eyebrow}</p>}
        <h2 className="text-sm font-semibold text-navy-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-navy-700/70">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
