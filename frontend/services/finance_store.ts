import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_RULES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_INCOME_CATEGORY_RULES,
  UNCATEGORIZED_CATEGORY_ID,
  UNCATEGORIZED_INCOME_CATEGORY_ID,
} from "@billie/parser";
import type { Bank, Category, CategoryGroup, CategoryRule } from "@billie/parser";
import { BACKUP_SCHEMA_VERSION } from "../types";
import type { BackupPayload, StoredExpense, StoredIncome } from "../types";
import { convertLegacyBackupPayloadToCurrent, convertLegacyExpenseToStoredExpense } from "./legacy_data_conversion";
import type { LegacyBackupPayload, LegacyStoredExpense } from "./legacy_data_conversion";

export type CategoryType = "expense" | "income";

// nome histórico, de quando o banco só guardava despesas: renomear faria quem já usa o app abrir um banco vazio
const DATABASE_NAME = "billie-expenses";
const DATABASE_VERSION = 4;
const EXPENSES_STORE = "expenses";
// nome da store de despesas até a versão 3 do banco
const LEGACY_EXPENSES_STORE = "transactions";
const INCOME_STORE = "income";
const CATEGORIES_STORE = "categories";
const CATEGORY_RULES_STORE = "categoryRules";

const LEGACY_BACKUP_SCHEMA_VERSION = 1;

type StoredEntry = StoredExpense | StoredIncome;
type EntryStoreName = typeof EXPENSES_STORE | typeof INCOME_STORE;

// como cada store é chamado na mensagem de erro de lançamento não encontrado
const ENTRY_STORE_LABELS: Record<EntryStoreName, string> = {
  [EXPENSES_STORE]: "transação",
  [INCOME_STORE]: "receita",
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains(EXPENSES_STORE)) {
        database.createObjectStore(EXPENSES_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(INCOME_STORE)) {
        database.createObjectStore(INCOME_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(CATEGORIES_STORE)) {
        database.createObjectStore(CATEGORIES_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(CATEGORY_RULES_STORE)) {
        database.createObjectStore(CATEGORY_RULES_STORE, { keyPath: "categoryId" });
      }

      if (event.oldVersion < 3 && request.transaction) {
        const categoriesStore = request.transaction.objectStore(CATEGORIES_STORE);
        categoriesStore.openCursor().onsuccess = (cursorEvent) => {
          const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (!cursor) return;
          if (!cursor.value.type) cursor.update({ ...cursor.value, type: "expense" });
          cursor.continue();
        };

        const incomeStore = request.transaction.objectStore(INCOME_STORE);
        incomeStore.openCursor().onsuccess = (cursorEvent) => {
          const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (!cursor) return;
          if (!cursor.value.categoryId) {
            cursor.update({ ...cursor.value, categoryId: UNCATEGORIZED_INCOME_CATEGORY_ID });
          }
          cursor.continue();
        };
      }

      if (database.objectStoreNames.contains(LEGACY_EXPENSES_STORE) && request.transaction) {
        const expensesStore = request.transaction.objectStore(EXPENSES_STORE);
        const legacyExpensesRequest: IDBRequest<LegacyStoredExpense[]> = request.transaction
          .objectStore(LEGACY_EXPENSES_STORE)
          .getAll();
        legacyExpensesRequest.onsuccess = () => {
          for (const legacyExpense of legacyExpensesRequest.result) {
            expensesStore.put(convertLegacyExpenseToStoredExpense(legacyExpense));
          }
          database.deleteObjectStore(LEGACY_EXPENSES_STORE);
        };
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runInStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll<T>(storeName: string): Promise<T[]> {
  return runInStore<T[]>(storeName, "readonly", (store) => store.getAll());
}

export function saveExpenseList(expenses: StoredExpense[]): Promise<{ added: number; duplicates: number }> {
  return saveStoredEntryList(EXPENSES_STORE, expenses);
}

export function listExpenses(): Promise<StoredExpense[]> {
  return getAll<StoredExpense>(EXPENSES_STORE);
}

export async function removeExpense(id: string): Promise<void> {
  await runInStore(EXPENSES_STORE, "readwrite", (store) => store.delete(id));
}

export function updateExpenseCategory(id: string, categoryId: string): Promise<void> {
  return updateStoredEntryCategory(EXPENSES_STORE, id, categoryId);
}

export function updateExpenseFields(
  id: string,
  changes: { date: string; description: string; amount: number }
): Promise<void> {
  return updateStoredEntryFields<StoredExpense>(EXPENSES_STORE, id, changes);
}

export function updateExpenseBank(id: string, bank: Bank | undefined): Promise<void> {
  return updateStoredEntryBank(EXPENSES_STORE, id, bank);
}

export function markExpenseIdListAsNotDuplicate(ids: string[]): Promise<void> {
  return markStoredEntryIdListAsNotDuplicate(EXPENSES_STORE, ids);
}

export async function saveIncome(entry: StoredIncome): Promise<void> {
  await runInStore(INCOME_STORE, "readwrite", (store) => store.put(entry));
}

export function saveIncomeList(entries: StoredIncome[]): Promise<{ added: number; duplicates: number }> {
  return saveStoredEntryList(INCOME_STORE, entries);
}

export function listIncome(): Promise<StoredIncome[]> {
  return getAll<StoredIncome>(INCOME_STORE);
}

export async function removeIncome(id: string): Promise<void> {
  await runInStore(INCOME_STORE, "readwrite", (store) => store.delete(id));
}

export function updateIncomeCategory(id: string, categoryId: string): Promise<void> {
  return updateStoredEntryCategory(INCOME_STORE, id, categoryId);
}

export async function countIncomeByCategory(categoryId: string): Promise<number> {
  const entries = await listIncome();
  return entries.filter((entry) => entry.categoryId === categoryId).length;
}

export function updateIncomeFields(
  id: string,
  changes: { date: string; description: string; amount: number }
): Promise<void> {
  return updateStoredEntryFields<StoredIncome>(INCOME_STORE, id, changes);
}

export function updateIncomeBank(id: string, bank: Bank | undefined): Promise<void> {
  return updateStoredEntryBank(INCOME_STORE, id, bank);
}

export function markIncomeIdListAsNotDuplicate(ids: string[]): Promise<void> {
  return markStoredEntryIdListAsNotDuplicate(INCOME_STORE, ids);
}

async function saveStoredEntryList<T extends StoredEntry>(
  storeName: EntryStoreName,
  entries: T[]
): Promise<{ added: number; duplicates: number }> {
  const existingById = new Map((await getAll<T>(storeName)).map((entry) => [entry.id, entry]));

  let added = 0;
  let duplicates = 0;

  for (const entry of entries) {
    const existing = existingById.get(entry.id);

    if (existing) {
      duplicates++;
    } else {
      added++;
    }

    const merged = existing ? mergeReimportedEntry(existing, entry) : entry;
    await runInStore(storeName, "readwrite", (store) => store.put(merged));
  }

  return { added, duplicates };
}

function mergeReimportedEntry<T extends StoredEntry>(existing: T, incoming: T): T {
  const keepCategory = existing.categoryOverridden || existing.detailsOverridden;
  return {
    ...incoming,
    ...(keepCategory && { categoryId: existing.categoryId, categoryOverridden: existing.categoryOverridden }),
    ...(existing.detailsOverridden && {
      date: existing.date,
      description: existing.description,
      amount: existing.amount,
      detailsOverridden: true,
    }),
    ...(existing.bankOverridden && { bank: existing.bank, bankOverridden: true }),
    ...(existing.duplicateDismissed && { duplicateDismissed: true }),
  };
}

function updateStoredEntryCategory(storeName: EntryStoreName, id: string, categoryId: string): Promise<void> {
  return changeStoredEntry(storeName, id, (entry) => ({ ...entry, categoryId, categoryOverridden: true }));
}

function updateStoredEntryFields<T extends StoredEntry>(
  storeName: EntryStoreName,
  id: string,
  changes: Partial<T> & { date: string; amount: number }
): Promise<void> {
  return changeStoredEntry<T>(storeName, id, (entry) => ({
    ...entry,
    ...changes,
    detailsOverridden: true,
    // O "não é duplicado" valia para a data/valor antigos: mudou algum deles, a verificação recomeça.
    ...((changes.date !== entry.date || changes.amount !== entry.amount) && { duplicateDismissed: false }),
  }));
}

function updateStoredEntryBank(storeName: EntryStoreName, id: string, bank: Bank | undefined): Promise<void> {
  return changeStoredEntry(storeName, id, (entry) => ({ ...entry, bank, bankOverridden: true }));
}

async function changeStoredEntry<T extends StoredEntry>(
  storeName: EntryStoreName,
  id: string,
  change: (entry: T) => T
): Promise<void> {
  const entry = await runInStore<T | undefined>(storeName, "readonly", (store) => store.get(id));
  if (!entry) throw new Error(`${ENTRY_STORE_LABELS[storeName]} #${id} não encontrada`);

  const updated = change(entry);
  await runInStore(storeName, "readwrite", (store) => store.put(updated));
}

async function markStoredEntryIdListAsNotDuplicate(storeName: EntryStoreName, ids: string[]): Promise<void> {
  for (const id of ids) {
    const entry = await runInStore<StoredEntry | undefined>(storeName, "readonly", (store) => store.get(id));
    if (!entry) continue;

    const updated: StoredEntry = { ...entry, duplicateDismissed: true };
    await runInStore(storeName, "readwrite", (store) => store.put(updated));
  }
}

async function ensureCategoriesSeeded(): Promise<void> {
  const existing = await getAll<Category>(CATEGORIES_STORE);

  if (!existing.some((category) => category.type === "expense")) {
    for (const category of DEFAULT_CATEGORIES) {
      await runInStore(CATEGORIES_STORE, "readwrite", (store) => store.put(category));
    }
    for (const rule of DEFAULT_CATEGORY_RULES) {
      await runInStore(CATEGORY_RULES_STORE, "readwrite", (store) => store.put(rule));
    }
  }

  if (!existing.some((category) => category.type === "income")) {
    for (const category of DEFAULT_INCOME_CATEGORIES) {
      await runInStore(CATEGORIES_STORE, "readwrite", (store) => store.put(category));
    }
    for (const rule of DEFAULT_INCOME_CATEGORY_RULES) {
      await runInStore(CATEGORY_RULES_STORE, "readwrite", (store) => store.put(rule));
    }
  }
}

export async function listCategories(type: CategoryType): Promise<Category[]> {
  await ensureCategoriesSeeded();
  const all = await getAll<Category>(CATEGORIES_STORE);
  return all.filter((category) => category.type === type);
}

export async function listCategoryRules(type: CategoryType): Promise<CategoryRule[]> {
  const categoryIds = new Set((await listCategories(type)).map((category) => category.id));
  const allRules = await getAll<CategoryRule>(CATEGORY_RULES_STORE);
  return allRules.filter((rule) => categoryIds.has(rule.categoryId));
}

export async function createCategory(
  input: { label: string; type: CategoryType; group?: CategoryGroup; keywords: string[] }
): Promise<Category> {
  await ensureCategoriesSeeded();

  const category: Category =
    input.type === "expense"
      ? { id: crypto.randomUUID(), label: input.label, type: "expense", group: input.group ?? "variable" }
      : { id: crypto.randomUUID(), label: input.label, type: "income" };

  await runInStore(CATEGORIES_STORE, "readwrite", (store) => store.put(category));
  await runInStore(CATEGORY_RULES_STORE, "readwrite", (store) =>
    store.put({ categoryId: category.id, keywords: input.keywords })
  );

  return category;
}

export async function updateCategory(
  id: string,
  changes: { label?: string; group?: CategoryGroup; keywords?: string[] }
): Promise<void> {
  await ensureCategoriesSeeded();

  if (changes.label !== undefined || changes.group !== undefined) {
    const category = await runInStore<Category>(CATEGORIES_STORE, "readonly", (store) => store.get(id));
    if (!category) throw new Error(`categoria #${id} não encontrada`);

    const updated: Category =
      category.type === "expense"
        ? { ...category, label: changes.label ?? category.label, group: changes.group ?? category.group }
        : { ...category, label: changes.label ?? category.label };
    await runInStore(CATEGORIES_STORE, "readwrite", (store) => store.put(updated));
  }

  if (changes.keywords !== undefined) {
    await runInStore(CATEGORY_RULES_STORE, "readwrite", (store) =>
      store.put({ categoryId: id, keywords: changes.keywords })
    );
  }
}

export async function countExpensesByCategory(categoryId: string): Promise<number> {
  const expenses = await listExpenses();
  return expenses.filter((expense) => expense.categoryId === categoryId).length;
}

export async function deleteCategory(id: string): Promise<void> {
  if (id === UNCATEGORIZED_CATEGORY_ID || id === UNCATEGORIZED_INCOME_CATEGORY_ID) {
    throw new Error('a categoria "Outros / Não categorizado" não pode ser excluída');
  }

  const category = await runInStore<Category>(CATEGORIES_STORE, "readonly", (store) => store.get(id));
  if (!category) throw new Error(`categoria #${id} não encontrada`);

  if (category.type === "expense") {
    const affected = (await listExpenses()).filter((expense) => expense.categoryId === id);
    for (const expense of affected) {
      await runInStore(EXPENSES_STORE, "readwrite", (store) =>
        store.put({ ...expense, categoryId: UNCATEGORIZED_CATEGORY_ID })
      );
    }
  } else {
    const affected = (await listIncome()).filter((entry) => entry.categoryId === id);
    for (const entry of affected) {
      await runInStore(INCOME_STORE, "readwrite", (store) =>
        store.put({ ...entry, categoryId: UNCATEGORIZED_INCOME_CATEGORY_ID })
      );
    }
  }

  await runInStore(CATEGORY_RULES_STORE, "readwrite", (store) => store.delete(id));
  await runInStore(CATEGORIES_STORE, "readwrite", (store) => store.delete(id));
}

export class BackupValidationError extends Error {}

export async function exportBackupData(): Promise<BackupPayload> {
  await ensureCategoriesSeeded();

  const [expenses, income, categories, categoryRules] = await Promise.all([
    listExpenses(),
    listIncome(),
    getAll<Category>(CATEGORIES_STORE),
    getAll<CategoryRule>(CATEGORY_RULES_STORE),
  ]);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    expenses,
    income,
    categories,
    categoryRules,
  };
}

export async function restoreBackupData(payload: unknown): Promise<void> {
  const backup = readBackupPayload(payload);

  for (const expense of backup.expenses) {
    await runInStore(EXPENSES_STORE, "readwrite", (store) => store.put(expense));
  }
  for (const entry of backup.income) {
    await runInStore(INCOME_STORE, "readwrite", (store) => store.put(entry));
  }
  for (const category of backup.categories) {
    await runInStore(CATEGORIES_STORE, "readwrite", (store) => store.put(category));
  }
  for (const rule of backup.categoryRules) {
    await runInStore(CATEGORY_RULES_STORE, "readwrite", (store) => store.put(rule));
  }
}

// aceita o formato atual e o da versão 1 (despesas na chave `transactions`, com `merchant`), convertendo-o
function readBackupPayload(payload: unknown): BackupPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new BackupValidationError("arquivo de backup inválido");
  }

  const candidate = payload as Record<string, unknown>;
  const expensesKey = backupExpensesKey(candidate.schemaVersion);
  const hasEveryList = [expensesKey, "income", "categories", "categoryRules"].every((key) =>
    Array.isArray(candidate[key])
  );
  if (!hasEveryList) throw new BackupValidationError("arquivo de backup inválido");

  return candidate.schemaVersion === LEGACY_BACKUP_SCHEMA_VERSION
    ? convertLegacyBackupPayloadToCurrent(payload as LegacyBackupPayload)
    : (payload as BackupPayload);
}

function backupExpensesKey(schemaVersion: unknown): "expenses" | "transactions" {
  if (schemaVersion === BACKUP_SCHEMA_VERSION) return "expenses";
  if (schemaVersion === LEGACY_BACKUP_SCHEMA_VERSION) return "transactions";
  throw new BackupValidationError("versão do arquivo de backup não suportada");
}
