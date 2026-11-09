export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isCsv(file: File): boolean {
  return file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
}

const BYTES_PER_KILOBYTE = 1024;

export function formatFileSize(sizeInBytes: number): string {
  if (sizeInBytes < BYTES_PER_KILOBYTE) return `${sizeInBytes} B`;

  const sizeInKilobytes = sizeInBytes / BYTES_PER_KILOBYTE;
  if (sizeInKilobytes < BYTES_PER_KILOBYTE) return `${Math.round(sizeInKilobytes)} KB`;

  const sizeInMegabytes = sizeInKilobytes / BYTES_PER_KILOBYTE;
  return `${sizeInMegabytes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}
