import type { Bank, Category } from "@billie/parser";
import { confirmAction } from "../../components/confirm_modal";
import { listAvailablePeriods } from "../../services/dre_aggregator";
import { groupPossibleDuplicateRows } from "../../services/duplicate_detection";
import {
  listCategories,
  listIncome,
  listTransactions,
  markIncomeIdListAsNotDuplicate,
  markTransactionIdListAsNotDuplicate,
  removeIncome,
  removeTransaction,
  updateIncomeBank,
  updateIncomeCategory,
  updateIncomeFields,
  updateTransactionBank,
  updateTransactionCategory,
  updateTransactionFields,
} from "../../services/finance_store";
import {
  getSelectedPeriod,
  listenSelectedPeriodChanged,
  setSelectedPeriod,
  syncSelectedPeriodWithAvailableList,
} from "../../services/selected_period";
import { listenStoredDataUpdated, notifyStoredDataUpdated } from "../../services/stored_data_events";
import { groupTransactionsByBank, groupTransactionsByDay, UNKNOWN_BANK_LABEL } from "../../services/transaction_grouping";
import type { TransactionGroup } from "../../services/transaction_grouping";
import type { StoredExpense, StoredIncome } from "../../types";
import { formatBrlCurrency } from "../../utils/currency_format";
import { escapeHtmlSpecialCharacters, getRequiredElementById } from "../../utils/dom_helpers";
import { buildCategoryOptionsHtml } from "./category_options_html";

type GroupMode = "none" | "bank" | "day";

interface ListedEntry {
  id: string;
  date: string;
  amount: number;
  categoryId: string;
  bank?: Bank;
  duplicateDismissed?: boolean;
}

interface EntryListOptions<T extends ListedEntry> {
  container: HTMLDivElement;
  amountKind: "expense" | "income";
  emptyMessage: string;
  // completa a pergunta "Excluir …?" na confirmação
  removeConfirmTarget: string;
  getDescription: (entry: T) => string;
  getGroupMode: () => GroupMode;
  setKeepEditingRowOnNextReload: (keep: boolean) => void;
  removeEntry: (id: string) => Promise<void>;
  updateEntryCategory: (id: string, categoryId: string) => Promise<void>;
  updateEntryBank: (id: string, bank: Bank | undefined) => Promise<void>;
  updateEntryFields: (id: string, changes: { date: string; description: string; amount: number }) => Promise<void>;
  markEntryIdListAsNotDuplicate: (ids: string[]) => Promise<void>;
}

interface EntryListController<T extends ListedEntry> {
  setEntriesAndCategories: (entries: T[], categories: Category[]) => void;
  stopEditing: () => void;
  render: () => void;
}

const BANK_OPTIONS: Bank[] = ["Nubank", "XP / Rico", "Santander"];

const BANK_BADGE_LABELS: Record<Bank, string> = {
  Nubank: "NU",
  "XP / Rico": "XP",
  Santander: "SAN",
};
const UNKNOWN_BANK_BADGE_LABEL = "?";

export function initTransactionLists(): void {
  const periodSelect = getRequiredElementById<HTMLSelectElement>("transactions-period");
  const groupModeSelect = getRequiredElementById<HTMLSelectElement>("transactions-group-mode");

  let groupMode: GroupMode = "none";
  // a troca de categoria/banco de uma linha em edição grava sem redesenhar a lista,
  // para não perder o que já foi digitado nos outros campos
  let keepEditingRowOnNextReload = false;

  const sharedOptions = {
    getGroupMode: () => groupMode,
    setKeepEditingRowOnNextReload: (keep: boolean) => {
      keepEditingRowOnNextReload = keep;
    },
  };

  const expenseList = createEntryListController<StoredExpense>({
    ...sharedOptions,
    container: getRequiredElementById<HTMLDivElement>("transaction-list"),
    amountKind: "expense",
    emptyMessage: "Nenhuma transação neste período.",
    removeConfirmTarget: "a transação",
    getDescription: (transaction) => transaction.merchant,
    removeEntry: removeTransaction,
    updateEntryCategory: updateTransactionCategory,
    updateEntryBank: updateTransactionBank,
    updateEntryFields: (id, { date, description, amount }) =>
      updateTransactionFields(id, { date, merchant: description, amount }),
    markEntryIdListAsNotDuplicate: markTransactionIdListAsNotDuplicate,
  });

  const incomeList = createEntryListController<StoredIncome>({
    ...sharedOptions,
    container: getRequiredElementById<HTMLDivElement>("income-entry-list"),
    amountKind: "income",
    emptyMessage: "Nenhuma receita lançada neste período.",
    removeConfirmTarget: "a receita",
    getDescription: (entry) => entry.description,
    removeEntry: removeIncome,
    updateEntryCategory: updateIncomeCategory,
    updateEntryBank: updateIncomeBank,
    updateEntryFields: updateIncomeFields,
    markEntryIdListAsNotDuplicate: markIncomeIdListAsNotDuplicate,
  });

  periodSelect.addEventListener("change", () => setSelectedPeriod(periodSelect.value));
  groupModeSelect.addEventListener("change", onGroupModeChange);
  listenSelectedPeriodChanged(onSelectedPeriodChange);
  listenStoredDataUpdated(() => void loadData());
  void loadData();

  async function loadData(): Promise<void> {
    const [transactions, income, expenseCategories, incomeCategories] = await Promise.all([
      listTransactions(),
      listIncome(),
      listCategories("expense"),
      listCategories("income"),
    ]);
    expenseList.setEntriesAndCategories(transactions, expenseCategories);
    incomeList.setEntriesAndCategories(income, incomeCategories);

    const periods = listAvailablePeriods(transactions, income);
    periodSelect.innerHTML = periods
      .map((period) => `<option value="${escapeHtmlSpecialCharacters(period)}">${escapeHtmlSpecialCharacters(period)}</option>`)
      .join("");
    syncSelectedPeriodWithAvailableList(periods);
    periodSelect.value = getSelectedPeriod();

    if (keepEditingRowOnNextReload) {
      keepEditingRowOnNextReload = false;
      return;
    }
    renderLists();
  }

  function onSelectedPeriodChange(): void {
    periodSelect.value = getSelectedPeriod();
    stopEditingAndRenderLists();
  }

  function onGroupModeChange(): void {
    groupMode = groupModeSelect.value as GroupMode;
    stopEditingAndRenderLists();
  }

  function stopEditingAndRenderLists(): void {
    expenseList.stopEditing();
    incomeList.stopEditing();
    renderLists();
  }

  function renderLists(): void {
    expenseList.render();
    incomeList.render();
  }
}

function createEntryListController<T extends ListedEntry>(options: EntryListOptions<T>): EntryListController<T> {
  const { container } = options;

  let entries: T[] = [];
  let categories: Category[] = [];
  let editingId: string | null = null;
  let possibleDuplicateIds = new Set<string>();

  return { setEntriesAndCategories, stopEditing, render };

  function setEntriesAndCategories(newEntries: T[], newCategories: Category[]): void {
    entries = newEntries;
    categories = newCategories;
  }

  function stopEditing(): void {
    editingId = null;
  }

  function render(): void {
    const period = getSelectedPeriod();
    const rows = entries
      .filter((entry) => entry.date.slice(0, 7) === period)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length === 0) {
      container.innerHTML = `<p class="empty-state">${escapeHtmlSpecialCharacters(options.emptyMessage)}</p>`;
      return;
    }

    // Calculado sobre o período inteiro, antes de agrupar: um par em grupos diferentes continua sinalizado.
    const duplicateGroups = groupPossibleDuplicateRows(rows);
    possibleDuplicateIds = new Set(duplicateGroups.flat().map((row) => row.id));

    container.innerHTML = duplicateNoticeHtml(duplicateGroups) + groupedRowsHtml(rows);
    wireEvents();
  }

  function groupedRowsHtml(rows: T[]): string {
    const groupMode = options.getGroupMode();
    if (groupMode === "bank") return groupListHtml(groupTransactionsByBank(rows), groupMode);
    if (groupMode === "day") return groupListHtml(groupTransactionsByDay(rows), groupMode);
    return rowsHtml(rows);
  }

  function groupListHtml(groups: TransactionGroup<T>[], groupMode: GroupMode): string {
    return groups
      .map(
        (group) => `
          <div class="entry-group">
            <div class="entry-group-header">
              <span>${escapeHtmlSpecialCharacters(groupHeaderLabel(group, groupMode))}</span>
              <span class="entry-group-subtotal">${formatBrlCurrency(group.total)}</span>
            </div>
            ${rowsHtml(group.transactions)}
          </div>
        `
      )
      .join("");
  }

  function rowsHtml(rows: T[]): string {
    return rows.map((row) => (row.id === editingId ? editRowHtml(row) : viewRowHtml(row))).join("");
  }

  function viewRowHtml(row: T): string {
    const duplicate = possibleDuplicateRowAttributes(possibleDuplicateIds.has(row.id));
    const description = escapeHtmlSpecialCharacters(options.getDescription(row));
    return `
      <div class="entry-row${duplicate.className}"${duplicate.title} data-id="${escapeHtmlSpecialCharacters(row.id)}">
        <span class="entry-date">${escapeHtmlSpecialCharacters(row.date)}</span>
        ${bankBadgeHtml(row.bank)}
        <span class="entry-description" title="${description}">${description}</span>
        <span class="entry-amount ${options.amountKind}">${formatBrlCurrency(row.amount)}</span>
        <select class="entry-category-select">${buildCategoryOptionsHtml(categories, row.categoryId)}</select>
        <button type="button" class="link-button entry-edit">Editar</button>
      </div>
    `;
  }

  function editRowHtml(row: T): string {
    return `
      <div class="entry-row entry-row-editing" data-id="${escapeHtmlSpecialCharacters(row.id)}">
        <div class="row-edit-line">
          <input type="date" class="entry-edit-date" value="${escapeHtmlSpecialCharacters(row.date)}" />
          <select class="entry-edit-bank" title="Banco de origem">${bankOptionsHtml(row.bank)}</select>
          <input type="text" class="entry-edit-description" value="${escapeHtmlSpecialCharacters(options.getDescription(row))}" />
          <input type="number" step="0.01" min="0.01" class="entry-edit-amount" value="${escapeHtmlSpecialCharacters(String(row.amount))}" />
          <select class="entry-category-select" title="Categoria">${buildCategoryOptionsHtml(categories, row.categoryId)}</select>
        </div>
        <div class="row-edit-actions">
          <button type="button" class="link-button entry-save">Salvar</button>
          <button type="button" class="link-button entry-cancel">Cancelar</button>
          <button type="button" class="link-button entry-remove">Excluir</button>
        </div>
      </div>
    `;
  }

  function wireEvents(): void {
    container.querySelectorAll<HTMLButtonElement>(".duplicate-dismiss").forEach((button) => {
      button.addEventListener("click", async () => {
        await options.markEntryIdListAsNotDuplicate(duplicateDismissIdList(button));
        notifyStoredDataUpdated();
      });
    });

    container.querySelectorAll<HTMLSelectElement>(".entry-category-select").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".entry-row");
        if (!row?.dataset.id) return;

        await options.updateEntryCategory(row.dataset.id, select.value);
        options.setKeepEditingRowOnNextReload(row.dataset.id === editingId);
        notifyStoredDataUpdated();
      });
    });

    container.querySelectorAll<HTMLSelectElement>(".entry-edit-bank").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".entry-row");
        if (!row?.dataset.id) return;

        await options.updateEntryBank(row.dataset.id, (select.value || undefined) as Bank | undefined);
        options.setKeepEditingRowOnNextReload(true);
        notifyStoredDataUpdated();
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".entry-remove").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".entry-row");
        if (!row?.dataset.id) return;

        const description =
          row.querySelector(".entry-description")?.textContent ??
          row.querySelector<HTMLInputElement>(".entry-edit-description")?.value ??
          "";
        if (!(await confirmAction(`Excluir ${options.removeConfirmTarget} "${description}"?`))) return;

        await options.removeEntry(row.dataset.id);
        editingId = null;
        notifyStoredDataUpdated();
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".entry-edit").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest<HTMLElement>(".entry-row");
        if (!row?.dataset.id) return;

        editingId = row.dataset.id;
        render();
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".entry-cancel").forEach((button) => {
      button.addEventListener("click", () => {
        editingId = null;
        render();
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".entry-save").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".entry-row");
        if (!row?.dataset.id) return;

        const date = row.querySelector<HTMLInputElement>(".entry-edit-date")?.value ?? "";
        const description = row.querySelector<HTMLInputElement>(".entry-edit-description")?.value.trim() ?? "";
        const amount = parseFloat(row.querySelector<HTMLInputElement>(".entry-edit-amount")?.value ?? "");
        if (!date || !description || Number.isNaN(amount) || amount <= 0) return;

        const original = entries.find((entry) => entry.id === row.dataset.id);
        if (
          !original ||
          date !== original.date ||
          description !== options.getDescription(original) ||
          amount !== original.amount
        ) {
          await options.updateEntryFields(row.dataset.id, { date, description, amount });
        }
        editingId = null;
        notifyStoredDataUpdated();
      });
    });
  }
}

function groupHeaderLabel(group: TransactionGroup<unknown>, groupMode: GroupMode): string {
  return groupMode === "day"
    ? new Date(`${group.key}T00:00:00`).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      })
    : group.label;
}

function bankOptionsHtml(selectedBank: Bank | undefined): string {
  const unknownOption = `<option value="" ${selectedBank ? "" : "selected"}>${escapeHtmlSpecialCharacters(UNKNOWN_BANK_LABEL)}</option>`;
  const bankOptions = BANK_OPTIONS.map(
    (bank) => `<option value="${escapeHtmlSpecialCharacters(bank)}" ${bank === selectedBank ? "selected" : ""}>${escapeHtmlSpecialCharacters(bank)}</option>`
  );
  return [unknownOption, ...bankOptions].join("");
}

function bankBadgeHtml(bank: Bank | undefined): string {
  const label = bank ? BANK_BADGE_LABELS[bank] : UNKNOWN_BANK_BADGE_LABEL;
  const title = bank ?? UNKNOWN_BANK_LABEL;
  return `<span class="bank-badge${bank ? "" : " bank-badge-unknown"}" title="${escapeHtmlSpecialCharacters(title)}">${escapeHtmlSpecialCharacters(label)}</span>`;
}

function duplicateNoticeHtml(duplicateGroups: { id: string; date: string; amount: number }[][]): string {
  if (duplicateGroups.length === 0) return "";

  const groupItemsHtml = duplicateGroups
    .map((group) => {
      const { date, amount } = group[0];
      const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const ids = group.map((row) => row.id).join(",");
      return `
        <li class="duplicate-notice-item">
          <span>${dateLabel} · ${formatBrlCurrency(amount)} · ${group.length} lançamentos</span>
          <button type="button" class="link-button duplicate-dismiss" data-ids="${escapeHtmlSpecialCharacters(ids)}">Não é duplicado</button>
        </li>
      `;
    })
    .join("");

  return `
    <div class="duplicate-notice" role="status">
      <p class="duplicate-notice-text">
        <span class="duplicate-notice-icon" aria-hidden="true">⚠</span>
        Possíveis duplicados neste período: lançamentos com o mesmo valor e a mesma data, marcados com uma barra na lateral.
      </p>
      <ul class="duplicate-notice-list">${groupItemsHtml}</ul>
    </div>
  `;
}

function duplicateDismissIdList(button: HTMLButtonElement): string[] {
  return (button.dataset.ids ?? "").split(",").filter(Boolean);
}

function possibleDuplicateRowAttributes(isPossibleDuplicate: boolean): { className: string; title: string } {
  return isPossibleDuplicate
    ? {
        className: " row-possible-duplicate",
        title: ` title="Possível duplicado: outro lançamento com o mesmo valor e data"`,
      }
    : { className: "", title: "" };
}
