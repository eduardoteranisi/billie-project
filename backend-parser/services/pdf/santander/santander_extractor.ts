import type { RawTransaction, Transaction } from "../../../types";
import { santanderGarbageWords, santanderPattern } from "./santander_patterns";
import { extractPdfLines } from "../pdf_text_extractor";
import { resolvePurchaseYear } from "../resolve_purchase_year";
import { finalizeTransactions } from "../../transaction_processor";

export async function extractSantander(
  pdfBytes: Uint8Array,
  year: string,
  password?: string
): Promise<{ expenses: Transaction[]; income: Transaction[] }> {
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
      const purchaseYear = resolvePurchaseYear(Number(month), year, now);

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

  return { expenses: finalizeTransactions(rawTransactions), income: [] };
}
