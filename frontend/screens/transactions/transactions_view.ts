import { initEntryAddForms } from "./entry_add_forms";
import { initEntryLists } from "./entry_lists";
import { initStatementImportPopover } from "./statement_import_popover";

export function initTransactionsView(): void {
  initStatementImportPopover();
  initEntryLists();
  initEntryAddForms();
}
