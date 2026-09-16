import { normalizeText } from "../text_utils";

export type CsvDocumentType = "fatura" | "extrato";

const BANKING_OPERATION_KEYWORDS = [
  "PIX",
  "TED",
  "DOC",
  "TRANSFERENCIA",
  "SAQUE",
  "DEPOSITO",
  "CREDITO EM CONTA",
  "APLICACAO",
];

const NOISE_ROW_KEYWORDS = ["PAGAMENTO", "ESTORNO"];

export function detectCsvDocumentType(descriptions: string[]): CsvDocumentType {
  const hasBankingOperation = descriptions.some((description) =>
    BANKING_OPERATION_KEYWORDS.some((keyword) => normalizedTextHasWord(description, keyword))
  );
  return hasBankingOperation ? "extrato" : "fatura";
}

export function isNoiseRow(description: string): boolean {
  return NOISE_ROW_KEYWORDS.some((keyword) => normalizedTextStartsWithWord(description, keyword));
}

function normalizedTextHasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(normalizeText(text));
}

function normalizedTextStartsWithWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}`).test(normalizeText(text));
}
