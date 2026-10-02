import type { CsvColumnConfig } from "@billie/parser";
import { escapeHtmlSpecialCharacters } from "../utils/dom_helpers";

export interface ColumnMappingSelects {
  date: HTMLSelectElement;
  merchant: HTMLSelectElement;
  amount: HTMLSelectElement;
  installment: HTMLSelectElement;
}

export function fillColumnMappingSelects(selects: ColumnMappingSelects, headers: string[]): void {
  const optionsHtml = headers
    .map((header) => `<option value="${escapeHtmlSpecialCharacters(header)}">${escapeHtmlSpecialCharacters(header)}</option>`)
    .join("");

  selects.date.innerHTML = optionsHtml;
  selects.merchant.innerHTML = optionsHtml;
  selects.amount.innerHTML = optionsHtml;
  selects.installment.innerHTML = `<option value="">— nenhuma —</option>${optionsHtml}`;
}

export function readColumnMappingSelects(selects: ColumnMappingSelects): CsvColumnConfig {
  return {
    date: selects.date.value,
    merchant: selects.merchant.value,
    amount: selects.amount.value,
    installment: selects.installment.value || undefined,
  };
}
