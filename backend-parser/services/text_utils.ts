export function normalizeText(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
