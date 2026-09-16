import type { CsvColumnConfig, Transaction } from "../../types";
import { parseCsvText } from "./csv_tokenizer";
import { resolveColumns, isColumnResolutionFailure } from "./csv_column_resolver";
import { CsvColumnMappingError } from "./csv_column_mapping_error";
import { detectCsvDocumentType, isNoiseRow } from "./csv_document_type";
import { finalizeCsvTransactions, parseAmount, type CsvRowInput } from "../transaction_processor";

export interface CsvParseResult {
  expenses: Transaction[];
  income: Transaction[];
}

export async function parseCsvInvoice(csvText: string, columns?: CsvColumnConfig): Promise<CsvParseResult> {
  const { headers, rows } = parseCsvText(csvText);

  const resolved = resolveColumns(headers, columns);
  if (isColumnResolutionFailure(resolved)) {
    throw new CsvColumnMappingError(resolved.headers, resolved.missingRoles);
  }

  const validRows: CsvRowInput[] = rows
    .map((row) => ({
      date: (row[resolved.date] ?? "").trim(),
      merchant: (row[resolved.merchant] ?? "").trim(),
      rawAmount: (row[resolved.amount] ?? "").trim(),
      isInstallment: resolved.installment !== null && isInstallmentValue(row[resolved.installment]),
    }))
    .filter((row) => row.date && row.merchant && row.rawAmount)
    .filter((row) => parseAmount(row.rawAmount) !== 0);

  if (validRows.length === 0) {
    throw new Error("Nenhuma transação válida encontrada no CSV.");
  }

  const documentType = detectCsvDocumentType(validRows.map((row) => row.merchant));
  return documentType === "fatura" ? finalizeFaturaRows(validRows) : finalizeExtratoRows(validRows);
}

function finalizeFaturaRows(validRows: CsvRowInput[]): CsvParseResult {
  const expenseRows = validRows.filter((row) => !isNoiseRow(row.merchant));
  return { expenses: finalizeCsvTransactions(expenseRows), income: [] };
}

function finalizeExtratoRows(validRows: CsvRowInput[]): CsvParseResult {
  const expenseRows = validRows
    .filter((row) => parseAmount(row.rawAmount) < 0)
    .map((row) => ({ ...row, rawAmount: row.rawAmount.replace("-", "") }));
  const incomeRows = validRows.filter((row) => parseAmount(row.rawAmount) > 0);

  return {
    expenses: finalizeCsvTransactions(expenseRows),
    income: finalizeCsvTransactions(incomeRows),
  };
}

function isInstallmentValue(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return trimmed !== "" && trimmed !== "-";
}
