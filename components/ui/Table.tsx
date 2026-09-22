import { cn } from "@/lib/utils/cn";

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-navy-900 text-left text-xs uppercase tracking-wide text-white">{children}</thead>;
}

export function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn("px-3 py-2 font-semibold", className)}>{children}</th>;
}

export function Td({
  className,
  children,
  highlight,
}: {
  className?: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-b border-sand-200 px-3 py-2 text-navy-900",
        highlight && "bg-accent-red/10 font-semibold text-accent-red",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tr className={cn("even:bg-sand-50/60", className)}>{children}</tr>;
}
