import {
  classifyTransactionDescription,
  classifyTransactionList,
  UNCATEGORIZED_INCOME_CATEGORY_ID,
  type Transaction,
} from "@billie/parser";
import { listCategoryRules, saveTransactions, saveIncomeEntries } from "./finance_store";
import type { StoredExpense, StoredIncome } from "../types";

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
  const incomeEntries: StoredIncome[] = income.map((entry) => ({
    id: entry.id,
    date: entry.date,
    description: entry.merchant,
    amount: entry.amount,
    categoryId: classifyTransactionDescription(entry.merchant, incomeRules, UNCATEGORIZED_INCOME_CATEGORY_ID),
    bank: entry.bank,
  }));
  return saveIncomeEntries(incomeEntries);
}

export function sumSaveResults(
  ...results: { added: number; duplicates: number }[]
): { added: number; duplicates: number } {
  return results.reduce(
    (total, result) => ({ added: total.added + result.added, duplicates: total.duplicates + result.duplicates }),
    { added: 0, duplicates: 0 }
  );
}
