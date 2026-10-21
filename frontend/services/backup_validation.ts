import type { Bank, Category, CategoryRule } from "@billie/parser";
import { BACKUP_SCHEMA_VERSION } from "../types";
import type { BackupPayload, StoredEntryFlags, StoredExpense, StoredIncome } from "../types";
import { convertLegacyBackupPayloadToCurrent } from "./legacy_data_conversion";
import type { LegacyBackupPayload } from "./legacy_data_conversion";

const LEGACY_BACKUP_SCHEMA_VERSION = 1;

// Folgados para qualquer backup real, mas impedem que um arquivo forjado encha o banco.
const MAX_LIST_LENGTH = 200_000;
const MAX_TEXT_LENGTH = 1_000;
const MAX_KEYWORDS_PER_RULE = 1_000;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BANKS: readonly Bank[] = ["Nubank", "XP / Rico", "Santander"];
const EXPENSE_ORIGINS: readonly StoredExpense["origin"][] = ["pdf", "manual", "csv"];
const ENTRY_FLAG_NAMES: readonly (keyof StoredEntryFlags)[] = [
  "categoryOverridden",
  "detailsOverridden",
  "bankOverridden",
  "duplicateDismissed",
];

export class BackupValidationError extends Error {}

// Aceita o formato atual e o da versão 1 (despesas na chave `transactions`, com `merchant`), convertendo-o.
// Cada item é reconstruído só com os campos conhecidos, com o tipo conferido: um backup corrompido ou
// forjado é recusado inteiro, antes de gravar qualquer coisa, em vez de quebrar as telas depois.
export function readBackupPayload(payload: unknown): BackupPayload {
  if (!isRecord(payload)) throw new BackupValidationError("arquivo de backup inválido");

  const expensesKey = backupExpensesKey(payload.schemaVersion);
  const hasEveryList = [expensesKey, "income", "categories", "categoryRules"].every((key) =>
    Array.isArray(payload[key])
  );
  if (!hasEveryList) throw new BackupValidationError("arquivo de backup inválido");

  const current =
    payload.schemaVersion === LEGACY_BACKUP_SCHEMA_VERSION ? convertLegacyPayload(payload) : payload;

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: typeof current.exportedAt === "string" ? current.exportedAt : "",
    expenses: readList(current.expenses, "despesa", readExpense),
    income: readList(current.income, "receita", readIncome),
    categories: readList(current.categories, "categoria", readCategory),
    categoryRules: readList(current.categoryRules, "regra de categoria", readCategoryRule),
  };
}

function backupExpensesKey(schemaVersion: unknown): "expenses" | "transactions" {
  if (schemaVersion === BACKUP_SCHEMA_VERSION) return "expenses";
  if (schemaVersion === LEGACY_BACKUP_SCHEMA_VERSION) return "transactions";
  throw new BackupValidationError("versão do arquivo de backup não suportada");
}

function convertLegacyPayload(payload: Record<string, unknown>): Record<string, unknown> {
  // a conversão desestrutura cada despesa: um item que nem é objeto é recusado aqui, com a mesma mensagem dos demais
  const legacyExpenses = payload.transactions as unknown[];
  const invalidIndex = legacyExpenses.findIndex((item) => !isRecord(item));
  if (invalidIndex !== -1) throw invalidItemError("despesa", invalidIndex);

  return { ...convertLegacyBackupPayloadToCurrent(payload as unknown as LegacyBackupPayload) };
}

function readList<T>(list: unknown, itemLabel: string, readItem: (item: Record<string, unknown>) => T | null): T[] {
  const items = list as unknown[];
  if (items.length > MAX_LIST_LENGTH) {
    throw new BackupValidationError(`arquivo de backup inválido: mais de ${MAX_LIST_LENGTH} itens do tipo ${itemLabel}`);
  }

  return items.map((item, index) => {
    const read = isRecord(item) ? readItem(item) : null;
    if (read === null) throw invalidItemError(itemLabel, index);
    return read;
  });
}

function readExpense(item: Record<string, unknown>): StoredExpense | null {
  const entry = readEntryFields(item);
  if (!entry || !isOneOf(item.origin, EXPENSE_ORIGINS)) return null;
  return { ...entry, origin: item.origin };
}

function readIncome(item: Record<string, unknown>): StoredIncome | null {
  return readEntryFields(item);
}

function readEntryFields(item: Record<string, unknown>): StoredIncome | null {
  const { id, date, description, amount, categoryId, bank } = item;
  if (!isText(id) || id === "" || !isText(date) || !ISO_DATE_PATTERN.test(date)) return null;
  if (!isText(description) || typeof amount !== "number" || !Number.isFinite(amount) || !isText(categoryId)) {
    return null;
  }
  if (bank !== undefined && !isOneOf(bank, BANKS)) return null;

  const entry: StoredIncome = { id, date, description, amount, categoryId };
  if (bank !== undefined) entry.bank = bank;

  for (const flagName of ENTRY_FLAG_NAMES) {
    const flag = item[flagName];
    if (flag === undefined) continue;
    if (typeof flag !== "boolean") return null;
    entry[flagName] = flag;
  }
  return entry;
}

function readCategory(item: Record<string, unknown>): Category | null {
  const { id, label, type, group } = item;
  if (!isText(id) || id === "" || !isText(label)) return null;

  if (type === "income") return { id, label, type };
  if (type === "expense" && (group === "fixed" || group === "variable")) return { id, label, type, group };
  return null;
}

function readCategoryRule(item: Record<string, unknown>): CategoryRule | null {
  const { categoryId, keywords } = item;
  if (!isText(categoryId) || categoryId === "" || !Array.isArray(keywords)) return null;
  if (keywords.length > MAX_KEYWORDS_PER_RULE || !keywords.every(isText)) return null;
  return { categoryId, keywords: [...keywords] };
}

function invalidItemError(itemLabel: string, index: number): BackupValidationError {
  return new BackupValidationError(`arquivo de backup inválido: ${itemLabel} nº ${index + 1} está corrompida ou incompleta`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_TEXT_LENGTH;
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}
