import { runPipeline, type Bank, type CsvColumnConfig, type LogFn, type Transaction } from "@billie/parser";
import {
  classifyAndSaveExpenseList,
  classifyAndSaveIncomeList,
  sumSaveResults,
} from "./transaction_saver";
import { notifyStoredDataUpdated } from "./stored_data_events";
import type { StoredExpense } from "../types";

// qualquer ano não numérico faz o parser deduzir o ano sozinho (resolvePurchaseYear)
export const AUTOMATIC_YEAR = "Automático (recomendado)";

export interface ParsedStatement {
  expenses: Transaction[];
  income: Transaction[];
}

export type CsvStatementParseResult =
  | { status: "parsed"; statement: ParsedStatement }
  | { status: "needsColumnMapping"; headers: string[] };

export interface SaveStatementResult {
  added: number;
  duplicates: number;
}

export async function parsePdfStatementFile(
  file: File,
  options: { bank: Bank; year: string; password?: string; onLog?: LogFn }
): Promise<ParsedStatement> {
  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  const result = await runPipeline({
    source: "pdf",
    pdfBytes,
    password: options.password,
    bank: options.bank,
    year: options.year,
    onLog: options.onLog ?? (() => {}),
  });

  if (!result.success || !result.transactions) {
    throw new Error(result.error ?? "erro desconhecido no processamento");
  }
  return { expenses: result.transactions, income: result.income ?? [] };
}

export async function parseCsvStatementText(
  csvText: string,
  options: { bank: Bank; columns?: CsvColumnConfig; onLog?: LogFn }
): Promise<CsvStatementParseResult> {
  const result = await runPipeline({
    source: "csv",
    csvText,
    columns: options.columns,
    bank: options.bank,
    onLog: options.onLog ?? (() => {}),
  });

  if (!result.success || !result.transactions) {
    if (result.needsColumnMapping) {
      return { status: "needsColumnMapping", headers: result.needsColumnMapping.headers };
    }
    throw new Error(result.error ?? "erro desconhecido no processamento");
  }
  return { status: "parsed", statement: { expenses: result.transactions, income: result.income ?? [] } };
}

export async function saveParsedStatementToFinanceStore(
  statement: ParsedStatement,
  origin: StoredExpense["origin"]
): Promise<SaveStatementResult> {
  const expensesResult = await classifyAndSaveExpenseList(statement.expenses, origin);
  const incomeResult = await classifyAndSaveIncomeList(statement.income);
  const total = sumSaveResults(expensesResult, incomeResult);

  notifyStoredDataUpdated();
  return total;
}
