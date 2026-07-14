import type { CsvColumnConfig, Transaction } from "../types";

export async function parseCsvInvoice(
  csvText: string,
  columns?: CsvColumnConfig
): Promise<Transaction[]> {
  throw new Error("Importação de CSV ainda não implementada.");
}
