import type { CsvColumnConfig } from "../../types";
import { normalizeText } from "../text_utils";

export type CsvColumnRole = "date" | "merchant" | "amount" | "installment";

const COLUMN_ALIASES: Record<CsvColumnRole, string[]> = {
  date: ["DATA", "DATA DA COMPRA", "DATA DE COMPRA", "DATE"],
  merchant: [
    "ESTABELECIMENTO",
    "DESCRICAO",
    "DESCRIÇÃO",
    "HISTORICO",
    "HISTÓRICO",
    "LANCAMENTO",
    "MERCHANT",
    "TITLE",
    "DESCRIPTION",
  ],
  amount: ["VALOR", "VALOR (R$)", "AMOUNT", "VALOR TRANSACAO"],
  installment: ["PARCELA", "PARCELAS", "INSTALLMENT"],
};

export interface ResolvedColumns {
  date: number;
  merchant: number;
  amount: number;
  installment: number | null;
}

export interface ColumnResolutionFailure {
  headers: string[];
  missingRoles: CsvColumnRole[];
}

export function resolveColumns(
  headers: string[],
  columns?: CsvColumnConfig
): ResolvedColumns | ColumnResolutionFailure {
  const normalizedHeaders = headers.map(normalizeText);

  if (columns) {
    return resolveFromExplicitColumns(headers, normalizedHeaders, columns);
  }

  const date = findByAlias(normalizedHeaders, COLUMN_ALIASES.date);
  const merchant = findByAlias(normalizedHeaders, COLUMN_ALIASES.merchant);
  const amount = findByAlias(normalizedHeaders, COLUMN_ALIASES.amount);
  const installment = findByAlias(normalizedHeaders, COLUMN_ALIASES.installment);

  const missingRoles: CsvColumnRole[] = [];
  if (date === null) missingRoles.push("date");
  if (merchant === null) missingRoles.push("merchant");
  if (amount === null) missingRoles.push("amount");

  if (missingRoles.length > 0) {
    return { headers, missingRoles };
  }

  return { date: date as number, merchant: merchant as number, amount: amount as number, installment };
}

function resolveFromExplicitColumns(
  headers: string[],
  normalizedHeaders: string[],
  columns: CsvColumnConfig
): ResolvedColumns {
  const date = findExact(headers, normalizedHeaders, columns.date, "date");
  const merchant = findExact(headers, normalizedHeaders, columns.merchant, "merchant");
  const amount = findExact(headers, normalizedHeaders, columns.amount, "amount");
  const installment =
    columns.installment !== undefined
      ? findExact(headers, normalizedHeaders, columns.installment, "installment")
      : findByAlias(normalizedHeaders, COLUMN_ALIASES.installment);

  return { date, merchant, amount, installment };
}

function findExact(headers: string[], normalizedHeaders: string[], headerName: string, role: CsvColumnRole): number {
  const index = normalizedHeaders.indexOf(normalizeText(headerName));
  if (index === -1) {
    throw new Error(
      `Coluna "${headerName}" (${role}) não encontrada no CSV. Cabeçalhos disponíveis: ${headers.join(", ")}.`
    );
  }
  return index;
}

function findByAlias(normalizedHeaders: string[], aliases: string[]): number | null {
  const normalizedAliases = aliases.map(normalizeText);
  const index = normalizedHeaders.findIndex((header) => normalizedAliases.includes(header));
  return index === -1 ? null : index;
}

export function isColumnResolutionFailure(
  result: ResolvedColumns | ColumnResolutionFailure
): result is ColumnResolutionFailure {
  return "missingRoles" in result;
}
