import {
  classifyTransactionList,
  UNCATEGORIZED_INCOME_CATEGORY_ID,
  type Transaction,
} from "@billie/parser";
import { listCategoryRules, saveTransactions, saveIncomeEntries } from "./finance_store";
import type { StoredExpense } from "../types";

export async function classifyAndSaveExpenseList(
  transactions: Transaction[],
  origin: StoredExpense["origin"]
) {
  const rules = await listCategoryRules("expense");
  const categorized = classifyTransactionList(transactions, rules);
  const storedExpenses: StoredExpense[] = categorized.map((transaction) => ({
    ...transaction,
    origin,
  }));
  return saveTransactions(storedExpenses);
}

export async function classifyAndSaveIncomeList(
  income: Transaction[] | undefined
): Promise<{ added: number; duplicates: number }> {
  if (!income || income.length === 0) return { added: 0, duplicates: 0 };

  const incomeRules = await listCategoryRules("income");
  return saveIncomeEntries(classifyTransactionList(income, incomeRules, UNCATEGORIZED_INCOME_CATEGORY_ID));
}

export function sumSaveResults(
  ...results: { added: number; duplicates: number }[]
): { added: number; duplicates: number } {
  return results.reduce(
    (total, result) => ({ added: total.added + result.added, duplicates: total.duplicates + result.duplicates }),
    { added: 0, duplicates: 0 }
  );
}
