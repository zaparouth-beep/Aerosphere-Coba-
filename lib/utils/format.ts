export function formatNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatRupiah(value: number): string {
  if (!Number.isFinite(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${formatNumber(value, decimals)}%`;
}
