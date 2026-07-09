import type { RawTransaction, Transaction } from "../types";
import {
  monthAbbreviations,
  nubankPattern,
  santanderGarbageWords,
  santanderPattern,
  xpRicoPattern,
} from "./bank_patterns";
import { extractPdfLines } from "./pdf_text_extractor";
import { finalizeTransactions } from "./transaction_processor";

export async function extractXpRico(
  pdfBytes: Uint8Array,
  year: string,
  password?: string
): Promise<Transaction[]> {
  const lines = await extractPdfLines(pdfBytes, password);
  const rawTransactions: RawTransaction[] = [];
  const now = new Date();

  for (const line of lines) {
    const match = xpRicoPattern.exec(line);
    if (!match) continue;

    const [, date, description, amount] = match;
    const descriptionLower = description.toLowerCase();

    if (amount.startsWith("-") || descriptionLower.startsWith("pagamento") || descriptionLower.includes("r$")) {
      continue;
    }

    const [day, month, yearPart] = date.split("/");
    let purchaseYear: number;

    if (yearPart) {
      purchaseYear = yearPart.length === 2 ? Number(yearPart) + 2000 : Number(yearPart);
    } else if (/^\d+$/.test(year)) {
      purchaseYear = Number(year);
    } else {
      purchaseYear = now.getFullYear();
      if (Number(month) > now.getMonth() + 1) purchaseYear -= 1;
    }

    rawTransactions.push({
      date: `${day}/${month}/${purchaseYear}`,
      dirtyDescription: description.trim(),
      rawAmount: amount,
    });
  }

  if (rawTransactions.length === 0) {
    throw new Error("Nenhuma transação encontrada no formato XP.");
  }

  return finalizeTransactions(rawTransactions);
}

export async function extractNubank(
  pdfBytes: Uint8Array,
  year: string,
  password?: string
): Promise<Transaction[]> {
  const lines = await extractPdfLines(pdfBytes, password);
  const rawTransactions: RawTransaction[] = [];
  const now = new Date();

  for (const line of lines) {
    const match = nubankPattern.exec(line);
    if (!match) continue;

    const [, dateStr, description, amount] = match;
    const descriptionLower = description.toLowerCase();

    if (amount.startsWith("-") || descriptionLower.includes("pagamento") || descriptionLower.includes("saldo")) {
      continue;
    }

    const cleanDescription = description.replace(/•+\s*\d*\s*/g, "").trim();

    const [dayStr, monthAbbr] = dateStr.toUpperCase().split(/\s+/);
    const day = dayStr.padStart(2, "0");
    const month = monthAbbreviations[monthAbbr] ?? "01";

    let purchaseYear = /^\d+$/.test(year) ? Number(year) : now.getFullYear();
    if (Number(month) > now.getMonth() + 1) purchaseYear -= 1;

    rawTransactions.push({
      date: `${day}/${month}/${purchaseYear}`,
      dirtyDescription: cleanDescription,
      rawAmount: amount,
    });
  }

  if (rawTransactions.length === 0) {
    throw new Error("Nenhuma transação encontrada no formato Nubank.");
  }

  return finalizeTransactions(rawTransactions);
}

export async function extractSantander(
  pdfBytes: Uint8Array,
  year: string,
  password?: string
): Promise<Transaction[]> {
  const rawLines = await extractPdfLines(pdfBytes, password);
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
      let purchaseYear = now.getFullYear();

      if (/^\d+$/.test(year)) {
        purchaseYear = Number(year);
      } else if (Number(month) > now.getMonth() + 1) {
        purchaseYear -= 1;
      }

      rawTransactions.push({
        date: `${day}/${month.padStart(2, "0")}/${purchaseYear}`,
        dirtyDescription: cleanDescription,
        rawAmount: amount,
      });
    }
  }

  if (rawTransactions.length === 0) {
    throw new Error("Nenhuma transação encontrada no formato Santander.");
  }

  return finalizeTransactions(rawTransactions);
}
