import type { RawTransaction, Transaction } from "../../../types";
import {
  santanderExtratoDocumentMarkerPattern,
  santanderExtratoPageBreakPattern,
  santanderExtratoSectionStartPattern,
  santanderExtratoSectionStopPattern,
  santanderExtratoTransactionPattern,
  santanderGarbageWords,
  santanderPattern,
} from "./santander_patterns";
import { extractPdfLines } from "../pdf_text_extractor";
import { resolvePurchaseYear } from "../resolve_purchase_year";
import { finalizeTransactions } from "../../transaction_processor";

export interface SantanderExtractionResult {
  expenses: Transaction[];
  income: Transaction[];
}

export async function extractSantander(
  pdfBytes: Uint8Array,
  year: string,
  password?: string
): Promise<SantanderExtractionResult> {
  const lines = await extractPdfLines(pdfBytes, password);

  return isSantanderExtratoDocument(lines)
    ? extractSantanderExtratoFromLines(lines, year)
    : extractSantanderFaturaFromLines(lines, year);
}

function extractSantanderFaturaFromLines(rawLines: string[], year: string): SantanderExtractionResult {
  const curedText = rawLines
    .join("\n")
    .replace(/,\s*\n\s*(\d{2})(?!\d)/g, ",$1");
  const lines = curedText.split("\n");

  const rawTransactions: RawTransaction[] = [];
  const now = new Date();

  for (const line of lines) {
    for (const match of line.matchAll(santanderPattern)) {
      const [, dateStr, description, amount] = match;
      const cleanDescription = description.trim();
      const descriptionLower = cleanDescription.toLowerCase();

      if (amount.startsWith("-") || santanderGarbageWords.some((word) => descriptionLower.includes(word))) {
        continue;
      }

      const [day, month] = dateStr.split("/");
      const purchaseYear = resolvePurchaseYear(Number(month), year, now);

      rawTransactions.push({
        date: `${day}/${month.padStart(2, "0")}/${purchaseYear}`,
        dirtyDescription: cleanDescription,
        rawAmount: amount,
      });
    }
  }

  if (rawTransactions.length === 0) {
    throw new Error("Nenhuma transação encontrada no formato Santander (fatura).");
  }

  return { expenses: finalizeTransactions(rawTransactions), income: [] };
}

function extractSantanderExtratoFromLines(lines: string[], year: string): SantanderExtractionResult {
  const startIndex = lines.findIndex((line) => santanderExtratoSectionStartPattern.test(line));
  const expenseRows: RawTransaction[] = [];
  const incomeRows: RawTransaction[] = [];
  const now = new Date();

  let currentDate: string | null = null;
  let pending: RawTransaction | null = null;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (santanderExtratoSectionStopPattern.test(line)) break;

    if (santanderExtratoPageBreakPattern.test(line)) {
      pending = null;
      continue;
    }

    const match = santanderExtratoTransactionPattern.exec(line);
    if (match) {
      const [, dateStr, description, amount, isDebit] = match;

      if (dateStr) {
        const [day, month] = dateStr.split("/");
        const purchaseYear = resolvePurchaseYear(Number(month), year, now);
        currentDate = `${day}/${month}/${purchaseYear}`;
      }
      if (!currentDate) continue;

      const cleanDescription = description.replace(/\s+/g, " ").trim();

      pending = {
        date: currentDate,
        dirtyDescription: cleanDescription,
        rawAmount: amount,
      };
      (isDebit ? expenseRows : incomeRows).push(pending);
      continue;
    }

    if (pending && line.trim()) {
      pending.dirtyDescription = `${pending.dirtyDescription} ${line.replace(/\s+/g, " ").trim()}`;
      pending = null;
    }
  }

  if (expenseRows.length === 0 && incomeRows.length === 0) {
    throw new Error("Nenhuma transação encontrada no formato Santander (extrato).");
  }

  return { expenses: finalizeTransactions(expenseRows), income: finalizeTransactions(incomeRows) };
}

function isSantanderExtratoDocument(lines: string[]): boolean {
  return lines.some((line) => santanderExtratoDocumentMarkerPattern.test(line));
}
