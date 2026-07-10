import type { CsvColumnConfig, Transaction } from "../types";

const CSV_DELIMITER = ";";
const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@", "\t", "\r"];

export const DEFAULT_CSV_COLUMNS: CsvColumnConfig = {
  date: "date",
  merchant: "merchant",
  amount: "amount",
};

function sanitizeCsvField(value: string): string {
  let field = value;

  if (FORMULA_TRIGGER_CHARS.some((char) => field.startsWith(char))) {
    field = `'${field}`;
  }

  if (field.includes(CSV_DELIMITER) || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    field = `"${field.replace(/"/g, '""')}"`;
  }

  return field;
}

export function exportToCsv(
  transactions: Transaction[],
  columns: CsvColumnConfig = DEFAULT_CSV_COLUMNS
): string {
  const header = [columns.date, columns.merchant, columns.amount]
    .map(sanitizeCsvField)
    .join(CSV_DELIMITER);
  const rows = transactions.map((t) =>
    [
      sanitizeCsvField(t.date),
      sanitizeCsvField(t.merchant),
      sanitizeCsvField(t.amount.toString().replace(".", ",")),
    ].join(CSV_DELIMITER)
  );

  const BOM = "\uFEFF";
  return BOM + [header, ...rows].join("\n");
}
