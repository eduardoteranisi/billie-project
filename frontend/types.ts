import type { Bank, Category, CategorizedTransaction, CategoryGroup, CategoryRule } from "@billie/parser";

export interface ManualIncomeEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  bank?: Bank;
}

export interface StoredTransaction extends CategorizedTransaction {
  origin: "pdf" | "manual" | "csv";
  categoryOverridden?: boolean;
  detailsOverridden?: boolean;
}

export interface CategorySummary {
  categoryId: string;
  label: string;
  group?: CategoryGroup;
  total: number;
}

export interface DreSummary {
  period: string;
  totalIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  result: number;
  expenseCategories: CategorySummary[];
  incomeCategories: CategorySummary[];
}

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupPayload {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  transactions: StoredTransaction[];
  income: ManualIncomeEntry[];
  categories: Category[];
  categoryRules: CategoryRule[];
}
