import SparkMD5 from "spark-md5";
import type { RawTransaction, Transaction } from "../types";

const installmentPattern = /parcela|\d{1,2}\s*\/\s*\d{1,2}/i;

interface ParsedTransaction {
  date: Date;
  dirtyDescription: string;
  amount: number;
}

export function finalizeTransactions(rawTransactions: RawTransaction[]): Transaction[] {
  const parsed: ParsedTransaction[] = rawTransactions.map((t) => ({
    date: parseBrazilianDate(t.date),
    dirtyDescription: t.dirtyDescription,
    amount: parseAmount(t.rawAmount),
  }));

  correctInstallmentDates(parsed);

  return parsed.map((t) => ({
    id: generateTransactionId(t.date, t.dirtyDescription, t.amount),
    date: formatIsoDate(t.date),
    merchant: t.dirtyDescription,
    amount: t.amount,
  }));
}

function parseAmount(rawAmount: string): number {
  return parseFloat(rawAmount.replace(/\./g, "").replace(",", "."));
}

function parseBrazilianDate(dateStr: string): Date {
  const [day, month, yearPart] = dateStr.split("/").map(Number);

  let year = yearPart;
  if (year === undefined) {
    year = new Date().getFullYear();
  } else if (year < 100) {
    year += 2000;
  }

  return new Date(year, month - 1, day);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function correctInstallmentDates(transactions: ParsedTransaction[]): void {
  const installmentRows = transactions.filter((t) => installmentPattern.test(t.dirtyDescription));
  const normalRows = transactions.filter((t) => !installmentPattern.test(t.dirtyDescription));

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

function generateTransactionId(date: Date, description: string, amount: number): string {
  const raw = `${formatIsoDate(date)}${description}${amount}`;
  return SparkMD5.hash(raw);
}