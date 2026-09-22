import { cn } from "@/lib/utils/cn";

type BadgeTone = "neutral" | "green" | "red" | "gold";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-sand-100 text-navy-700 border-sand-200",
  green: "bg-accent-green/10 text-accent-green border-accent-green/20",
  red: "bg-accent-red/10 text-accent-red border-accent-red/20",
  gold: "bg-accent-gold/10 text-accent-gold border-accent-gold/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
