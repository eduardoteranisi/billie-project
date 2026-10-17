import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Bank, CsvColumnConfig } from "@billie/parser";

const TEST_DATA_DIRECTORY_URL = new URL("../../../backend-parser/test-data/", import.meta.url);
const STATEMENT_LIST_FILE_NAME = "local_statement_list.json";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface LocalStatementBase {
  file: string;
  // data em que o arquivo "é importado": o parser usa a data de hoje para deduzir o ano,
  // então o relógio do teste é congelado nela para o snapshot não mudar com o passar dos meses.
  referenceDate: string;
}

export interface LocalPdfStatement extends LocalStatementBase {
  kind: "pdf";
  bank: Bank;
  year: string; // qualquer valor não numérico faz o parser deduzir o ano sozinho
  password?: string;
}

export interface LocalCsvStatement extends LocalStatementBase {
  kind: "csv";
  bank?: Bank; // só rotula as transações
  columns?: CsvColumnConfig; // sem mapeamento, vale a detecção automática de colunas
}

export type LocalStatement = LocalPdfStatement | LocalCsvStatement;

export function readLocalStatementList(): LocalStatement[] {
  const listPath = resolveTestDataPath(STATEMENT_LIST_FILE_NAME);
  if (!existsSync(listPath)) {
    throw new Error(
      `Lista local não encontrada: ${listPath}. Crie-a a partir de frontend/tests/local/local_statement_list.example.json.`
    );
  }

  const entries: unknown = JSON.parse(readFileSync(listPath, "utf8"));
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`${STATEMENT_LIST_FILE_NAME} precisa ser uma lista com pelo menos um arquivo.`);
  }
  return entries.map(parseLocalStatementEntry);
}

export function readStatementPdfBytes(statement: LocalPdfStatement): Uint8Array {
  return new Uint8Array(readFileSync(resolveTestDataPath(statement.file)));
}

export function readStatementCsvText(statement: LocalCsvStatement): string {
  return readFileSync(resolveTestDataPath(statement.file), "utf8");
}

function resolveTestDataPath(fileName: string): string {
  return fileURLToPath(new URL(fileName, TEST_DATA_DIRECTORY_URL));
}

function parseLocalStatementEntry(entry: Record<string, unknown>, index: number): LocalStatement {
  const { file, referenceDate } = entry;
  if (typeof file !== "string" || file === "") {
    throw new Error(`${STATEMENT_LIST_FILE_NAME}: o item ${index + 1} não tem "file".`);
  }
  if (!existsSync(resolveTestDataPath(file))) {
    throw new Error(`${STATEMENT_LIST_FILE_NAME}: "${file}" não existe em backend-parser/test-data/.`);
  }
  if (typeof referenceDate !== "string" || !ISO_DATE_PATTERN.test(referenceDate)) {
    throw new Error(`${STATEMENT_LIST_FILE_NAME}: "${file}" precisa de "referenceDate" no formato aaaa-mm-dd.`);
  }

  const lowerCaseFile = file.toLowerCase();
  if (lowerCaseFile.endsWith(".csv")) {
    return { ...entry, file, referenceDate, kind: "csv" } as LocalCsvStatement;
  }
  if (!lowerCaseFile.endsWith(".pdf")) {
    throw new Error(`${STATEMENT_LIST_FILE_NAME}: "${file}" não é PDF nem CSV.`);
  }
  if (typeof entry.bank !== "string" || typeof entry.year !== "string") {
    throw new Error(`${STATEMENT_LIST_FILE_NAME}: "${file}" precisa de "bank" e "year" (texto).`);
  }
  return { ...entry, file, referenceDate, kind: "pdf" } as LocalPdfStatement;
}
