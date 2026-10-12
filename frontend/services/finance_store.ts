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

export type CategoryType = "expense" | "income";

// nome histórico, de quando o banco só guardava despesas: renomear faria quem já usa o app abrir um banco vazio
const DATABASE_NAME = "billie-expenses";
const DATABASE_VERSION = 3;
const TRANSACTIONS_STORE = "transactions";
const INCOME_STORE = "income";
const CATEGORIES_STORE = "categories";
const CATEGORY_RULES_STORE = "categoryRules";

type StoredEntry = StoredExpense | StoredIncome;
type EntryStoreName = typeof TRANSACTIONS_STORE | typeof INCOME_STORE;

// como cada store é chamado na mensagem de erro de lançamento não encontrado
const ENTRY_STORE_LABELS: Record<EntryStoreName, string> = {
  [TRANSACTIONS_STORE]: "transação",
  [INCOME_STORE]: "receita",
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TRANSACTIONS_STORE)) {
        database.createObjectStore(TRANSACTIONS_STORE, { keyPath: "id" });
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

export function saveTransactions(transactions: StoredExpense[]): Promise<{ added: number; duplicates: number }> {
  return saveStoredEntryList(TRANSACTIONS_STORE, transactions, (transaction) => ({
    date: transaction.date,
    merchant: transaction.merchant,
    amount: transaction.amount,
  }));
}

export function listTransactions(): Promise<StoredExpense[]> {
  return getAll<StoredExpense>(TRANSACTIONS_STORE);
}

export async function removeTransaction(id: string): Promise<void> {
  await runInStore(TRANSACTIONS_STORE, "readwrite", (store) => store.delete(id));
}

export function updateTransactionCategory(id: string, categoryId: string): Promise<void> {
  return updateStoredEntryCategory(TRANSACTIONS_STORE, id, categoryId);
}

export function updateTransactionFields(
  id: string,
  changes: { date: string; merchant: string; amount: number }
): Promise<void> {
  return updateStoredEntryFields<StoredExpense>(TRANSACTIONS_STORE, id, changes);
}

export function updateTransactionBank(id: string, bank: Bank | undefined): Promise<void> {
  return updateStoredEntryBank(TRANSACTIONS_STORE, id, bank);
}

export function markTransactionIdListAsNotDuplicate(ids: string[]): Promise<void> {
  return markStoredEntryIdListAsNotDuplicate(TRANSACTIONS_STORE, ids);
}

export async function saveIncome(entry: StoredIncome): Promise<void> {
  await runInStore(INCOME_STORE, "readwrite", (store) => store.put(entry));
}

export function saveIncomeEntries(entries: StoredIncome[]): Promise<{ added: number; duplicates: number }> {
  return saveStoredEntryList(INCOME_STORE, entries, (entry) => ({
    date: entry.date,
    description: entry.description,
    amount: entry.amount,
  }));
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
  entries: T[],
  pickEditableDetails: (entry: T) => Partial<T>
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

    const merged = existing ? mergeReimportedEntry(existing, entry, pickEditableDetails) : entry;
    await runInStore(storeName, "readwrite", (store) => store.put(merged));
  }

  return { added, duplicates };
}

function mergeReimportedEntry<T extends StoredEntry>(
  existing: T,
  incoming: T,
  pickEditableDetails: (entry: T) => Partial<T>
): T {
  const keepCategory = existing.categoryOverridden || existing.detailsOverridden;
  return {
    ...incoming,
    ...(keepCategory && { categoryId: existing.categoryId, categoryOverridden: existing.categoryOverridden }),
    ...(existing.detailsOverridden && { ...pickEditableDetails(existing), detailsOverridden: true }),
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

export async function countTransactionsByCategory(categoryId: string): Promise<number> {
  const transactions = await listTransactions();
  return transactions.filter((transaction) => transaction.categoryId === categoryId).length;
}

export async function deleteCategory(id: string): Promise<void> {
  if (id === UNCATEGORIZED_CATEGORY_ID || id === UNCATEGORIZED_INCOME_CATEGORY_ID) {
    throw new Error('a categoria "Outros / Não categorizado" não pode ser excluída');
  }

  const category = await runInStore<Category>(CATEGORIES_STORE, "readonly", (store) => store.get(id));
  if (!category) throw new Error(`categoria #${id} não encontrada`);

  if (category.type === "expense") {
    const affected = (await listTransactions()).filter((transaction) => transaction.categoryId === id);
    for (const transaction of affected) {
      await runInStore(TRANSACTIONS_STORE, "readwrite", (store) =>
        store.put({ ...transaction, categoryId: UNCATEGORIZED_CATEGORY_ID })
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

  const [transactions, income, categories, categoryRules] = await Promise.all([
    listTransactions(),
    listIncome(),
    getAll<Category>(CATEGORIES_STORE),
    getAll<CategoryRule>(CATEGORY_RULES_STORE),
  ]);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    transactions,
    income,
    categories,
    categoryRules,
  };
}

function validateBackupPayload(payload: unknown): asserts payload is BackupPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new BackupValidationError("arquivo de backup inválido");
  }

  const candidate = payload as Partial<BackupPayload>;
  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupValidationError("versão do arquivo de backup não suportada");
  }
  if (
    !Array.isArray(candidate.transactions) ||
    !Array.isArray(candidate.income) ||
    !Array.isArray(candidate.categories) ||
    !Array.isArray(candidate.categoryRules)
  ) {
    throw new BackupValidationError("arquivo de backup inválido");
  }
}

export async function restoreBackupData(payload: unknown): Promise<void> {
  validateBackupPayload(payload);

  for (const transaction of payload.transactions) {
    await runInStore(TRANSACTIONS_STORE, "readwrite", (store) => store.put(transaction));
  }
  for (const entry of payload.income) {
    await runInStore(INCOME_STORE, "readwrite", (store) => store.put(entry));
  }
  for (const category of payload.categories) {
    await runInStore(CATEGORIES_STORE, "readwrite", (store) => store.put(category));
  }
  for (const rule of payload.categoryRules) {
    await runInStore(CATEGORY_RULES_STORE, "readwrite", (store) => store.put(rule));
  }
}
