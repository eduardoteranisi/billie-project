import { UNCATEGORIZED_CATEGORY_ID, UNCATEGORIZED_INCOME_CATEGORY_ID, type Bank, type Category } from "@billie/parser";

export const UNKNOWN_BANK_LABEL = "Outros / Não identificado";
export const UNKNOWN_CATEGORY_LABEL = "Outros / Não categorizado";

const UNCATEGORIZED_CATEGORY_ID_SET = new Set([UNCATEGORIZED_CATEGORY_ID, UNCATEGORIZED_INCOME_CATEGORY_ID]);

export interface TransactionGroup<T> {
  key: string;
  label: string;
  total: number;
  transactions: T[];
}

export function groupTransactionsByBank<T extends { bank?: Bank; amount: number }>(
  transactions: T[]
): TransactionGroup<T>[] {
  const groupsByBank = new Map<string, TransactionGroup<T>>();

  for (const transaction of transactions) {
    const key = transaction.bank ?? UNKNOWN_BANK_LABEL;
    const group = groupsByBank.get(key) ?? { key, label: key, total: 0, transactions: [] };
    group.total += transaction.amount;
    group.transactions.push(transaction);
    groupsByBank.set(key, group);
  }

  const groups = [...groupsByBank.values()];
  const knownBankGroups = groups.filter((group) => group.key !== UNKNOWN_BANK_LABEL).sort((a, b) => b.total - a.total);
  const unknownBankGroup = groups.find((group) => group.key === UNKNOWN_BANK_LABEL);

  return unknownBankGroup ? [...knownBankGroups, unknownBankGroup] : knownBankGroups;
}

export function groupTransactionsByCategory<T extends { categoryId: string; amount: number }>(
  transactions: T[],
  categories: Category[]
): TransactionGroup<T>[] {
  const labelsByCategoryId = new Map(categories.map((category) => [category.id, category.label]));
  // uma categoria que não existe mais entra no grupo "Outros / Não categorizado", sem criar um segundo grupo com o mesmo nome
  const uncategorizedKey =
    categories.find((category) => UNCATEGORIZED_CATEGORY_ID_SET.has(category.id))?.id ?? UNCATEGORIZED_CATEGORY_ID;
  const groupsByCategory = new Map<string, TransactionGroup<T>>();

  for (const transaction of transactions) {
    const key = labelsByCategoryId.has(transaction.categoryId) ? transaction.categoryId : uncategorizedKey;
    const label = labelsByCategoryId.get(key) ?? UNKNOWN_CATEGORY_LABEL;
    const group = groupsByCategory.get(key) ?? { key, label, total: 0, transactions: [] };
    group.total += transaction.amount;
    group.transactions.push(transaction);
    groupsByCategory.set(key, group);
  }

  const groups = [...groupsByCategory.values()];
  const categorizedGroups = groups.filter((group) => group.key !== uncategorizedKey).sort((a, b) => b.total - a.total);
  const uncategorizedGroup = groups.find((group) => group.key === uncategorizedKey);

  return uncategorizedGroup ? [...categorizedGroups, uncategorizedGroup] : categorizedGroups;
}

export function groupTransactionsByDay<T extends { date: string; amount: number }>(
  transactions: T[]
): TransactionGroup<T>[] {
  const groupsByDay = new Map<string, TransactionGroup<T>>();

  for (const transaction of transactions) {
    const key = transaction.date;
    const group = groupsByDay.get(key) ?? { key, label: key, total: 0, transactions: [] };
    group.total += transaction.amount;
    group.transactions.push(transaction);
    groupsByDay.set(key, group);
  }

  return [...groupsByDay.values()].sort((a, b) => a.key.localeCompare(b.key));
}
