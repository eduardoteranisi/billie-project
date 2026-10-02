import { runPipeline, type Bank, type CsvColumnConfig, type LogFn, type Transaction } from "@billie/parser";
import {
  classificarESalvarTransacoes,
  salvarIncomeNoControle,
  somarResultadosSalvamento,
} from "./transaction_saver";
import type { StoredTransaction } from "../types";

// qualquer ano não numérico faz o parser deduzir o ano sozinho (resolvePurchaseYear)
export const AUTOMATIC_YEAR = "Automático (recomendado)";

export const EXPENSES_UPDATED_EVENT = "billie:expenses-updated";

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

export async function saveParsedStatementToExpenses(
  statement: ParsedStatement,
  origin: StoredTransaction["origin"]
): Promise<SaveStatementResult> {
  const expensesResult = await classificarESalvarTransacoes(statement.expenses, origin);
  const incomeResult = await salvarIncomeNoControle(statement.income);
  const total = somarResultadosSalvamento(expensesResult, incomeResult);

  document.dispatchEvent(new Event(EXPENSES_UPDATED_EVENT));
  return total;
}
