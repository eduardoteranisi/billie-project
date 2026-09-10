import SparkMD5 from "spark-md5";
import type { RawTransaction, Transaction } from "../types";

const installmentPattern = /parcela|\d{1,2}\s*\/\s*\d{1,2}/i;

interface ParsedTransaction {
  date: Date;
  dirtyDescription: string;
  amount: number;
}

export interface CsvRowInput {
  date: string;
  merchant: string;
  rawAmount: string;
  isInstallment: boolean;
}

function finalizeParsedTransactions<T>(
  rows: T[],
  toParsed: (row: T) => ParsedTransaction,
  isInstallment: (row: T, index: number) => boolean
): Transaction[] {
  const parsed = rows.map(toParsed);
  correctInstallmentDates(parsed, (_t, index) => isInstallment(rows[index], index));
  return finalizeParsed(parsed);
}

export function finalizeTransactions(rawTransactions: RawTransaction[]): Transaction[] {
  return finalizeParsedTransactions(
    rawTransactions,
    (t) => ({
      date: parseTransactionDate(t.date),
      dirtyDescription: t.dirtyDescription,
      amount: parseAmount(t.rawAmount),
    }),
    (t) => installmentPattern.test(t.dirtyDescription)
  );
}

export function finalizeCsvTransactions(rows: CsvRowInput[]): Transaction[] {
  return finalizeParsedTransactions(
    rows,
    (row) => ({
      date: parseTransactionDate(row.date),
      dirtyDescription: row.merchant,
      amount: parseAmount(row.rawAmount),
    }),
    (row) => row.isInstallment
  );
}

function finalizeParsed(parsed: ParsedTransaction[]): Transaction[] {
  return parsed.map((t) => ({
    id: generateTransactionId(t.date, t.dirtyDescription, t.amount),
    date: formatIsoDate(t.date),
    merchant: t.dirtyDescription,
    amount: t.amount,
  }));
}

export function parseAmount(rawAmount: string): number {
  const cleaned = rawAmount.replace(/R\$\s*/i, "").replace(/\s+/g, "");
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(cleaned);
}

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseTransactionDate(dateStr: string): Date {
  const isoMatch = isoDatePattern.exec(dateStr.trim());
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const [day, month, yearPart] = dateStr.split("/").map(Number);

  let year = yearPart;
  if (year === undefined) {
    year = new Date().getFullYear();
  } else if (year < 100) {
    year += 2000;
  }

  return new Date(year, month - 1, day);
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function correctInstallmentDates(
  transactions: ParsedTransaction[],
  isInstallment: (t: ParsedTransaction, index: number) => boolean
): void {
  const installmentRows = transactions.filter((t, i) => isInstallment(t, i));
  const normalRows = transactions.filter((t, i) => !isInstallment(t, i));

  if (installmentRows.length === 0 || normalRows.length === 0) return;

  const invoiceMonth = mostFrequent(normalRows.map((t) => t.date.getMonth()));
  const invoiceYear = mostFrequent(normalRows.map((t) => t.date.getFullYear()));

  for (const row of installmentRows) {
    const lastDay = new Date(invoiceYear, invoiceMonth + 1, 0).getDate();
    const safeDay = Math.min(row.date.getDate(), lastDay);
    row.date = new Date(invoiceYear, invoiceMonth, safeDay);
  }
}

function mostFrequent(values: number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function generateTransactionId(date: Date, description: string, amount: number): string {
  const raw = `${formatIsoDate(date)}${normalizeDescriptionForId(description)}${amount}`;
  return SparkMD5.hash(raw);
}

function normalizeDescriptionForId(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
