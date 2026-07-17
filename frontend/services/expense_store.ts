import type { ManualIncomeEntry, StoredTransaction } from "../types";

const DATABASE_NAME = "billie-expenses";
const DATABASE_VERSION = 1;
const TRANSACTIONS_STORE = "transactions";
const INCOME_STORE = "income";

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
  const existingIds = new Set((await listTransactions()).map((transaction) => transaction.id));

  let added = 0;
  let duplicates = 0;

  for (const transaction of transactions) {
    if (existingIds.has(transaction.id)) {
      duplicates++;
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

export async function saveIncome(entry: ManualIncomeEntry): Promise<void> {
  await runInStore(INCOME_STORE, "readwrite", (store) => store.put(entry));
}

export function listIncome(): Promise<ManualIncomeEntry[]> {
  return getAll<ManualIncomeEntry>(INCOME_STORE);
}

export async function removeIncome(id: string): Promise<void> {
  await runInStore(INCOME_STORE, "readwrite", (store) => store.delete(id));
}
