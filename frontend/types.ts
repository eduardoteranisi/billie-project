import type { Bank, Category, CategorizedTransaction, CategoryGroup, CategoryRule } from "@billie/parser";

export interface StoredEntryFlags {
  categoryOverridden?: boolean;
  detailsOverridden?: boolean;
  bankOverridden?: boolean;
  duplicateDismissed?: boolean;
}

export interface StoredIncome extends StoredEntryFlags {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  bank?: Bank;
}

export interface StoredExpense extends CategorizedTransaction, StoredEntryFlags {
  origin: "pdf" | "manual" | "csv";
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
  transactions: StoredExpense[];
  income: StoredIncome[];
  categories: Category[];
  categoryRules: CategoryRule[];
}
