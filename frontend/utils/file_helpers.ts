export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isCsv(file: File): boolean {
  return file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
}

// Devolve a mensagem para o usuário quando o arquivo não pode ser importado, ou null quando pode.
export function findStatementFileProblem(file: File): string | null {
  if (!isPdf(file) && !isCsv(file)) return `"${file.name}" não é PDF nem CSV.`;
  if (file.size === 0) return `"${file.name}" está vazio.`;
  return null;
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
