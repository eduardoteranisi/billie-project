import type { RawTransaction, Transaction } from "../../../types";
import { monthAbbreviations, nubankPattern } from "./nubank_patterns";
import { extractPdfLines } from "../pdf_text_extractor";
import { resolvePurchaseYear } from "../resolve_purchase_year";
import { finalizeTransactions } from "../../transaction_processor";

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

    const purchaseYear = resolvePurchaseYear(Number(month), year, now, { alwaysAdjustForRollover: true });

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
