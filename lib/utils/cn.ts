import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges class names; later Tailwind utilities override earlier ones (e.g. a width passed to an input). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
