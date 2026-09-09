import {
  classifyTransactionDescription,
  classifyTransactionList,
  UNCATEGORIZED_INCOME_CATEGORY_ID,
  type Transaction,
} from "@billie/parser";
import { listCategoryRules, saveTransactions, saveIncomeEntries } from "./expense_store";
import type { ManualIncomeEntry, StoredTransaction } from "../types";

export async function classificarESalvarTransacoes(
  transactions: Transaction[],
  origin: StoredTransaction["origin"]
) {
  const rules = await listCategoryRules("expense");
  const categorized = classifyTransactionList(transactions, rules);
  const storedTransactions: StoredTransaction[] = categorized.map((transaction) => ({
    ...transaction,
    origin,
  }));
  return saveTransactions(storedTransactions);
}

export async function salvarIncomeNoControle(
  income: Transaction[] | undefined
): Promise<{ added: number; duplicates: number }> {
  if (!income || income.length === 0) return { added: 0, duplicates: 0 };

  const incomeRules = await listCategoryRules("income");
  const incomeEntries: ManualIncomeEntry[] = income.map((entry) => ({
    id: entry.id,
    date: entry.date,
    description: entry.merchant,
    amount: entry.amount,
    categoryId: classifyTransactionDescription(entry.merchant, incomeRules, UNCATEGORIZED_INCOME_CATEGORY_ID),
  }));
  return saveIncomeEntries(incomeEntries);
}

export function somarResultadosSalvamento(
  ...resultados: { added: number; duplicates: number }[]
): { added: number; duplicates: number } {
  return resultados.reduce(
    (total, resultado) => ({ added: total.added + resultado.added, duplicates: total.duplicates + resultado.duplicates }),
    { added: 0, duplicates: 0 }
  );
}
