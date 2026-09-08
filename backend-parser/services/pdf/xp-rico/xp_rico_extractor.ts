import type { RawTransaction, Transaction } from "../../../types";
import { xpRicoExtratoPattern, xpRicoFaturaPattern } from "./xp_rico_patterns";
import { extractPdfLines } from "../pdf_text_extractor";
import { resolvePurchaseYear } from "../resolve_purchase_year";
import { finalizeTransactions } from "../../transaction_processor";

export interface XpRicoExtractionResult {
  expenses: Transaction[];
  income: Transaction[];
}

export async function extractXpRico(
  pdfBytes: Uint8Array,
  year: string,
  password?: string
): Promise<XpRicoExtractionResult> {
  const lines = await extractPdfLines(pdfBytes, password);

  return isXpRicoExtratoDocument(lines)
    ? extractXpRicoExtratoFromLines(lines, year)
    : extractXpRicoFaturaFromLines(lines, year);
}

function extractXpRicoFaturaFromLines(lines: string[], year: string): XpRicoExtractionResult {
  const rawTransactions: RawTransaction[] = [];
  const now = new Date();

  for (const line of lines) {
    const match = xpRicoFaturaPattern.exec(line);
    if (!match) continue;

    const [, date, description, amount] = match;
    const descriptionLower = description.toLowerCase();

    if (amount.startsWith("-") || descriptionLower.startsWith("pagamento") || descriptionLower.includes("r$")) {
      continue;
    }

    const [day, month, yearPart] = date.split("/");
    const explicitYear = yearPart ? (yearPart.length === 2 ? Number(yearPart) + 2000 : Number(yearPart)) : undefined;
    const purchaseYear = resolvePurchaseYear(Number(month), year, now, { explicitYear });

    rawTransactions.push({
      date: `${day}/${month}/${purchaseYear}`,
      dirtyDescription: description.trim(),
      rawAmount: amount,
    });
  }

  if (rawTransactions.length === 0) {
    throw new Error("Nenhuma transação encontrada no formato XP (fatura).");
  }

  return { expenses: finalizeTransactions(rawTransactions), income: [] };
}

function mergeXpRicoExtratoDateLines(lines: string[]): string[] {
  const merged: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const dateOnlyMatch = /(\d{2}\/\d{2}\/\d{2,4})\s+às\s*$/i.exec(lines[i]);
    if (dateOnlyMatch && lines[i + 1] !== undefined) {
      merged.push(`${dateOnlyMatch[1]} ${lines[i + 1]}`);
      i += 1;
      continue;
    }
    merged.push(lines[i]);
  }

  return merged;
}

function extractXpRicoExtratoFromLines(lines: string[], year: string): XpRicoExtractionResult {
  const mergedLines = mergeXpRicoExtratoDateLines(lines);
  const expenseRows: RawTransaction[] = [];
  const incomeRows: RawTransaction[] = [];
  const now = new Date();

  for (const line of mergedLines) {
    const match = xpRicoExtratoPattern.exec(line);
    if (!match) continue;

    const [, date, description, amount] = match;

    const [day, month, yearPart] = date.split("/");
    const explicitYear = yearPart ? (yearPart.length === 2 ? Number(yearPart) + 2000 : Number(yearPart)) : undefined;
    const purchaseYear = resolvePurchaseYear(Number(month), year, now, { explicitYear });

    // no extrato, "-" indica débito (despesa); valores sem sinal são créditos (receita).
    const isExpense = amount.trim().startsWith("-");

    (isExpense ? expenseRows : incomeRows).push({
      date: `${day}/${month}/${purchaseYear}`,
      dirtyDescription: description.trim(),
      rawAmount: isExpense ? amount.replace("-", "") : amount,
    });
  }

  if (expenseRows.length === 0 && incomeRows.length === 0) {
    throw new Error("Nenhuma transação encontrada no formato XP (extrato).");
  }

  return { expenses: finalizeTransactions(expenseRows), income: finalizeTransactions(incomeRows) };
}

function isXpRicoExtratoDocument(lines: string[]): boolean {
  return lines.some((line) => /extrato/i.test(line));
}
