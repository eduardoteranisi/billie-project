import type { RawTransaction, Transaction } from "../../../types";
import {
  monthAbbreviations,
  nubankExtratoAmountAtEndPattern,
  nubankExtratoDayHeaderPattern,
  nubankExtratoFooterPattern,
  nubankExtratoGroupHeaderPattern,
  nubankExtratoPeriodEndPattern,
  nubankExtratoRendimentoPattern,
  nubankExtratoStopPattern,
  nubankFaturaPattern,
} from "./nubank_patterns";
import { extractPdfLines } from "../pdf_text_extractor";
import { resolvePurchaseYear } from "../resolve_purchase_year";
import { finalizeTransactions } from "../../transaction_processor";

export interface NubankExtractionResult {
  expenses: Transaction[];
  income: Transaction[];
}

export async function extractNubank(
  pdfBytes: Uint8Array,
  year: string,
  password?: string
): Promise<NubankExtractionResult> {
  const lines = await extractPdfLines(pdfBytes, password);

  return isNubankExtratoDocument(lines)
    ? extractNubankExtratoFromLines(lines)
    : extractNubankFaturaFromLines(lines, year);
}

function extractNubankFaturaFromLines(lines: string[], year: string): NubankExtractionResult {
  const rawTransactions: RawTransaction[] = [];
  const now = new Date();

  for (const line of lines) {
    const match = nubankFaturaPattern.exec(line);
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
    throw new Error("Nenhuma transação encontrada no formato Nubank (fatura).");
  }

  return { expenses: finalizeTransactions(rawTransactions), income: [] };
}

function extractNubankExtratoFromLines(lines: string[]): NubankExtractionResult {
  const startIndex = lines.findIndex((line) => /movimentações/i.test(line));
  const expenseRows: RawTransaction[] = [];
  const incomeRows: RawTransaction[] = [];

  let currentDate: string | null = null;
  let isExpenseGroup = true;
  let pending: RawTransaction | null = null;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (nubankExtratoStopPattern.test(line)) break;

    if (nubankExtratoFooterPattern.test(line)) {
      pending = null;
      continue;
    }

    const dayHeaderMatch = nubankExtratoDayHeaderPattern.exec(line);
    if (dayHeaderMatch) {
      const [, dayStr, monthAbbr, yearStr, direction] = dayHeaderMatch;
      const day = dayStr.padStart(2, "0");
      const month = monthAbbreviations[monthAbbr.toUpperCase()] ?? "01";
      currentDate = `${day}/${month}/${yearStr}`;
      isExpenseGroup = direction.toLowerCase() === "saídas";
      pending = null;
      continue;
    }

    if (!currentDate) continue;

    const groupHeaderMatch = nubankExtratoGroupHeaderPattern.exec(line);
    if (groupHeaderMatch) {
      const [, direction] = groupHeaderMatch;
      isExpenseGroup = direction.toLowerCase() === "saídas";
      pending = null;
      continue;
    }

    const amountMatch = nubankExtratoAmountAtEndPattern.exec(line);
    if (amountMatch) {
      const [, description, amount] = amountMatch;
      const cleanDescription = description.replace(/\s+/g, " ").trim();
      pending = {
        date: currentDate,
        dirtyDescription: cleanDescription,
        rawAmount: amount,
      };
      (isExpenseGroup ? expenseRows : incomeRows).push(pending);
      continue;
    }

    if (pending && line.trim()) {
      pending.dirtyDescription = `${pending.dirtyDescription} ${line.replace(/\s+/g, " ").trim()}`;
    }
  }

  const rendimentoRow = extractRendimentoRow(lines);
  if (rendimentoRow) incomeRows.push(rendimentoRow);

  if (expenseRows.length === 0 && incomeRows.length === 0) {
    throw new Error("Nenhuma transação encontrada no formato Nubank (extrato).");
  }

  return { expenses: finalizeTransactions(expenseRows), income: finalizeTransactions(incomeRows) };
}

function extractRendimentoRow(lines: string[]): RawTransaction | null {
  const rendimentoLine = lines.find((line) => nubankExtratoRendimentoPattern.test(line));
  const rendimentoMatch = rendimentoLine ? nubankExtratoRendimentoPattern.exec(rendimentoLine) : null;
  if (!rendimentoMatch) return null;

  const periodLine = lines.find((line) => nubankExtratoPeriodEndPattern.test(line));
  const periodMatch = periodLine ? nubankExtratoPeriodEndPattern.exec(periodLine) : null;
  if (!periodMatch) return null;

  const [, rawAmount] = rendimentoMatch;
  const [, dayStr, monthName, yearStr] = periodMatch;
  const day = dayStr.padStart(2, "0");
  const month = monthAbbreviations[monthName.slice(0, 3).toUpperCase()] ?? "01";

  return {
    date: `${day}/${month}/${yearStr}`,
    dirtyDescription: "Rendimento líquido",
    rawAmount,
  };
}

function isNubankExtratoDocument(lines: string[]): boolean {
  return lines.some((line) => /movimentações/i.test(line));
}
