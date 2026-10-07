import { cn } from "@/lib/utils/cn";

export function Table({ className, children, caption }: { className?: string; children: React.ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-sand-200">
      <table className={cn("w-full border-collapse text-sm", className)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-navy-900 text-left text-[11px] uppercase tracking-wide text-white">{children}</thead>;
}

export function Th({ className, children, align }: { className?: string; children?: React.ReactNode; align?: "right" | "center" }) {
  return (
    <th scope="col" className={cn("whitespace-nowrap px-3 py-2 font-semibold", align === "right" && "text-right", align === "center" && "text-center", className)}>
      {children}
    </th>
  );
}

export function Td({
  className,
  children,
  align,
  num,
  colSpan,
}: {
  className?: string;
  children?: React.ReactNode;
  align?: "right" | "center";
  num?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-t border-sand-200 px-3 py-2 align-middle text-navy-900",
        (align === "right" || num) && "text-right",
        align === "center" && "text-center",
        num && "num whitespace-nowrap",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={cn("bg-white even:bg-sand-50/50", onClick && "cursor-pointer hover:bg-brand-blue/5", className)}>
      {children}
    </tr>
  );
}
