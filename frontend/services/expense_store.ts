import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_RULES, UNCATEGORIZED_CATEGORY_ID } from "@billie/parser";
import type { Category, CategoryGroup, CategoryRule } from "@billie/parser";
import type { ManualIncomeEntry, StoredTransaction } from "../types";

const DATABASE_NAME = "billie-expenses";
const DATABASE_VERSION = 2;
const TRANSACTIONS_STORE = "transactions";
const INCOME_STORE = "income";
const CATEGORIES_STORE = "categories";
const CATEGORY_RULES_STORE = "categoryRules";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
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

export async function saveTransactions(
  transactions: StoredTransaction[]
): Promise<{ added: number; duplicates: number }> {
  const existingById = new Map((await listTransactions()).map((transaction) => [transaction.id, transaction]));

  let added = 0;
  let duplicates = 0;

  for (const transaction of transactions) {
    const existing = existingById.get(transaction.id);

    if (existing) {
      duplicates++;
      if (existing.categoryOverridden || existing.detailsOverridden) continue;
    } else {
      added++;
    }

    await runInStore(TRANSACTIONS_STORE, "readwrite", (store) => store.put(transaction));
  }

  return { added, duplicates };
}

export function listTransactions(): Promise<StoredTransaction[]> {
  return getAll<StoredTransaction>(TRANSACTIONS_STORE);
}

export async function removeTransaction(id: string): Promise<void> {
  await runInStore(TRANSACTIONS_STORE, "readwrite", (store) => store.delete(id));
}

export async function updateTransactionCategory(id: string, categoryId: string): Promise<void> {
  const transaction = await runInStore<StoredTransaction>(TRANSACTIONS_STORE, "readonly", (store) => store.get(id));
  if (!transaction) throw new Error(`transação #${id} não encontrada`);

  const updated: StoredTransaction = { ...transaction, categoryId, categoryOverridden: true };
  await runInStore(TRANSACTIONS_STORE, "readwrite", (store) => store.put(updated));
}

export async function updateTransactionFields(
  id: string,
  changes: { date: string; merchant: string; amount: number }
): Promise<void> {
  const transaction = await runInStore<StoredTransaction>(TRANSACTIONS_STORE, "readonly", (store) => store.get(id));
  if (!transaction) throw new Error(`transação #${id} não encontrada`);

  const updated: StoredTransaction = { ...transaction, ...changes, detailsOverridden: true };
  await runInStore(TRANSACTIONS_STORE, "readwrite", (store) => store.put(updated));
}

export async function saveIncome(entry: ManualIncomeEntry): Promise<void> {
  await runInStore(INCOME_STORE, "readwrite", (store) => store.put(entry));
}

export function listIncome(): Promise<ManualIncomeEntry[]> {
  return getAll<ManualIncomeEntry>(INCOME_STORE);
}

export async function removeIncome(id: string): Promise<void> {
  await runInStore(INCOME_STORE, "readwrite", (store) => store.delete(id));
}

async function ensureCategoriesSeeded(): Promise<void> {
  const existing = await getAll<Category>(CATEGORIES_STORE);
  if (existing.length > 0) return;

  for (const category of DEFAULT_CATEGORIES) {
    await runInStore(CATEGORIES_STORE, "readwrite", (store) => store.put(category));
  }
  for (const rule of DEFAULT_CATEGORY_RULES) {
    await runInStore(CATEGORY_RULES_STORE, "readwrite", (store) => store.put(rule));
  }
}

export async function listCategories(): Promise<Category[]> {
  await ensureCategoriesSeeded();
  return getAll<Category>(CATEGORIES_STORE);
}

export async function listCategoryRules(): Promise<CategoryRule[]> {
  await ensureCategoriesSeeded();
  return getAll<CategoryRule>(CATEGORY_RULES_STORE);
}

export async function createCategory(input: { label: string; group: CategoryGroup; keywords: string[] }): Promise<Category> {
  await ensureCategoriesSeeded();

  const category: Category = { id: crypto.randomUUID(), label: input.label, group: input.group };
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

    const updated: Category = {
      ...category,
      label: changes.label ?? category.label,
      group: changes.group ?? category.group,
    };
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
  if (id === UNCATEGORIZED_CATEGORY_ID) {
    throw new Error('a categoria "Outros / Não categorizado" não pode ser excluída');
  }

  const affected = (await listTransactions()).filter((transaction) => transaction.categoryId === id);
  for (const transaction of affected) {
    await runInStore(TRANSACTIONS_STORE, "readwrite", (store) =>
      store.put({ ...transaction, categoryId: UNCATEGORIZED_CATEGORY_ID })
    );
  }

  await runInStore(CATEGORY_RULES_STORE, "readwrite", (store) => store.delete(id));
  await runInStore(CATEGORIES_STORE, "readwrite", (store) => store.delete(id));
}
