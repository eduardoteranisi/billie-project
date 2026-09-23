import type { Bank } from "@billie/parser";

export const UNKNOWN_BANK_LABEL = "Outros / Não identificado";

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
