import type { CsvColumnConfig, Transaction } from "../../types";
import { parseCsvText } from "./csv_tokenizer";
import { resolveColumns, isColumnResolutionFailure } from "./csv_column_resolver";
import { CsvColumnMappingError } from "./csv_column_mapping_error";
import { finalizeCsvTransactions, parseAmount, type CsvRowInput } from "../transaction_processor";

export async function parseCsvInvoice(csvText: string, columns?: CsvColumnConfig): Promise<Transaction[]> {
  const { headers, rows } = parseCsvText(csvText);

  const resolved = resolveColumns(headers, columns);
  if (isColumnResolutionFailure(resolved)) {
    throw new CsvColumnMappingError(resolved.headers, resolved.missingRoles);
  }

  const rowInputs: CsvRowInput[] = rows
    .map((row) => ({
      date: (row[resolved.date] ?? "").trim(),
      merchant: (row[resolved.merchant] ?? "").trim(),
      rawAmount: (row[resolved.amount] ?? "").trim(),
      isInstallment: resolved.installment !== null && isInstallmentValue(row[resolved.installment]),
    }))
    .filter((row) => row.date && row.merchant && row.rawAmount)
    .filter((row) => parseAmount(row.rawAmount) > 0);

  if (rowInputs.length === 0) {
    throw new Error("Nenhuma transação válida encontrada no CSV.");
  }

  return finalizeCsvTransactions(rowInputs);
}

function isInstallmentValue(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return trimmed !== "" && trimmed !== "-";
}
