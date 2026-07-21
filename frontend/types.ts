import type { CategorizedTransaction, CategoryGroup } from "@billie/parser";

export interface ManualIncomeEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface StoredTransaction extends CategorizedTransaction {
  origin: "pdf" | "manual";
  categoryOverridden?: boolean;
  detailsOverridden?: boolean;
}

export interface CategorySummary {
  categoryId: string;
  label: string;
  group: CategoryGroup;
  total: number;
}

export interface DreSummary {
  period: string;
  totalIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  result: number;
  categories: CategorySummary[];
}
