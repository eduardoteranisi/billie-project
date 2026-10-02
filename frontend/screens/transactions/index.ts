import { initTransactionAddForms } from "./add_forms";
import { initTransactionLists } from "./lists";
import { initStatementImportPopover } from "./statement_import_popover";

export function initTransactionsView(): void {
  initStatementImportPopover();
  initTransactionLists();
  initTransactionAddForms();
}
