import type { Category } from "@billie/parser";
import type { CategorySummary, DreSummary, StoredExpense, StoredIncome } from "../types";

export function listAvailablePeriods(expenses: StoredExpense[], income: StoredIncome[]): string[] {
  const periods = new Set<string>();
  for (const expense of expenses) periods.add(expense.date.slice(0, 7));
  for (const entry of income) periods.add(entry.date.slice(0, 7));
  return [...periods].sort().reverse();
}

function summarizeByCategory(
  categories: Category[],
  totalsByCategory: Map<string, number>
): CategorySummary[] {
  return categories
    .map((category) => ({
      categoryId: category.id,
      label: category.label,
      group: category.type === "expense" ? category.group : undefined,
      total: totalsByCategory.get(category.id) ?? 0,
    }))
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function calculateDre(
  period: string,
  expenses: StoredExpense[],
  income: StoredIncome[],
  allCategories: Category[]
): DreSummary {
  const periodExpenses = expenses.filter((expense) => expense.date.slice(0, 7) === period);
  const periodIncome = income.filter((entry) => entry.date.slice(0, 7) === period);

  const totalIncome = periodIncome.reduce((sum, entry) => sum + entry.amount, 0);

  const expenseTotalsByCategory = new Map<string, number>();
  for (const expense of periodExpenses) {
    expenseTotalsByCategory.set(
      expense.categoryId,
      (expenseTotalsByCategory.get(expense.categoryId) ?? 0) + expense.amount
    );
  }

  const incomeTotalsByCategory = new Map<string, number>();
  for (const entry of periodIncome) {
    incomeTotalsByCategory.set(entry.categoryId, (incomeTotalsByCategory.get(entry.categoryId) ?? 0) + entry.amount);
  }

  const expenseCategories = summarizeByCategory(
    allCategories.filter((category) => category.type === "expense"),
    expenseTotalsByCategory
  );
  const incomeCategories = summarizeByCategory(
    allCategories.filter((category) => category.type === "income"),
    incomeTotalsByCategory
  );

  const fixedExpenses = expenseCategories
    .filter((category) => category.group === "fixed")
    .reduce((sum, category) => sum + category.total, 0);

  const variableExpenses = expenseCategories
    .filter((category) => category.group === "variable")
    .reduce((sum, category) => sum + category.total, 0);

  return {
    period,
    totalIncome,
    fixedExpenses,
    variableExpenses,
    result: totalIncome - fixedExpenses - variableExpenses,
    expenseCategories,
    incomeCategories,
  };
}
