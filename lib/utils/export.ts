function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJSON(data: unknown, filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), filename, "application/json");
}

export function downloadCSV(rows: Array<Record<string, string | number>>, filename: string) {
  if (rows.length === 0) {
    downloadBlob("", filename, "text/csv");
    return;
  }
  const firstRow = rows[0];
  if (!firstRow) return;
  const headers = Object.keys(firstRow);
  const escape = (value: string | number) => {
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ];
  downloadBlob(lines.join("\n"), filename, "text/csv");
}
