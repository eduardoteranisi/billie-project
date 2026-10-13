import type { Category, CategoryRule, CsvColumnConfig } from "@billie/parser";
import { BACKUP_SCHEMA_VERSION } from "../types";
import type { BackupPayload, StoredExpense, StoredIncome } from "../types";

// Formatos gravados por versões antigas do app (banco até a v3, backup v1, colunas do CSV no localStorage),
// em que a descrição do lançamento se chamava `merchant`. Ver ADR 0008.
export type LegacyStoredExpense = Omit<StoredExpense, "description"> & { merchant: string };

export interface LegacyBackupPayload {
  schemaVersion: 1;
  exportedAt: string;
  transactions: LegacyStoredExpense[];
  income: StoredIncome[];
  categories: Category[];
  categoryRules: CategoryRule[];
}

const LEGACY_DEFAULT_DESCRIPTION_COLUMN = "merchant";

export function convertLegacyExpenseToStoredExpense(legacyExpense: LegacyStoredExpense): StoredExpense {
  const { merchant, ...otherFields } = legacyExpense;
  return { ...otherFields, description: merchant };
}

export function convertLegacyBackupPayloadToCurrent(legacyPayload: LegacyBackupPayload): BackupPayload {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: legacyPayload.exportedAt,
    expenses: legacyPayload.transactions.map(convertLegacyExpenseToStoredExpense),
    income: legacyPayload.income,
    categories: legacyPayload.categories,
    categoryRules: legacyPayload.categoryRules,
  };
}

// A configuração antiga guardava o nome da coluna de descrição na chave `merchant`. Quem nunca trocou
// esse nome tem o padrão antigo salvo e passa a usar o padrão novo; um nome escolhido pelo usuário é mantido.
export function convertSavedCsvColumnsToCurrent(
  savedColumns: Record<string, unknown>,
  defaultColumns: CsvColumnConfig
): CsvColumnConfig {
  const { merchant: legacyDescription, ...currentFields } = savedColumns;
  const columns: CsvColumnConfig = { ...defaultColumns, ...currentFields };

  const hasCustomLegacyDescription =
    typeof legacyDescription === "string" && legacyDescription !== LEGACY_DEFAULT_DESCRIPTION_COLUMN;
  if (hasCustomLegacyDescription && !("description" in savedColumns)) {
    columns.description = legacyDescription;
  }

  return columns;
}
