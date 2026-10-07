/** Indonesian number formatting (1.234,5), PRD 3.1 typography rules. */

export function fmt(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value);
}

/** Significant-figure formatting for impact values that span many magnitudes. */
export function fmtSig(value: number): string {
  if (!Number.isFinite(value)) return "–";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs < 0.001 || abs >= 1e9) return value.toExponential(2).replace(".", ",");
  return fmt(value, abs < 1 ? 4 : abs < 100 ? 2 : 1);
}

export function fmtRp(value: number): string {
  if (!Number.isFinite(value)) return "Rp –";
  const sign = value < 0 ? "−" : "";
  return `${sign}Rp${Math.round(Math.abs(value)).toLocaleString("id-ID")}`;
}

export function fmtRpShort(value: number): string {
  if (!Number.isFinite(value)) return "Rp –";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}Rp${fmt(abs / 1e9, 2)} M`;
  if (abs >= 1e6) return `${sign}Rp${fmt(abs / 1e6, 2)} jt`;
  if (abs >= 1e3) return `${sign}Rp${fmt(abs / 1e3, 1)} rb`;
  return `${sign}Rp${fmt(abs, 0)}`;
}

export function fmtPct(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "–";
  return `${fmt(value, decimals)}%`;
}

export function fmtDelta(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "–";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${fmt(Math.abs(value), decimals)}%`;
}

export function fmtDate(iso?: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}
