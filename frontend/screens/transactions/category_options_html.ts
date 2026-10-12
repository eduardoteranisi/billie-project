import type { Category } from "@billie/parser";
import { escapeHtmlSpecialCharacters } from "../../utils/dom_helpers";

export function buildCategoryOptionsHtml(categories: Category[], selectedCategoryId: string): string {
  return categories
    .map(
      (category) =>
        `<option value="${escapeHtmlSpecialCharacters(category.id)}" ${category.id === selectedCategoryId ? "selected" : ""}>${escapeHtmlSpecialCharacters(category.label)}</option>`
    )
    .join("");
}
