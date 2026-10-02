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
import type { ManualIncomeEntry, StoredTransaction } from "../../types";
import { formatBrlCurrency } from "../../utils/currency_format";
import { escapeHtmlSpecialCharacters, getRequiredElementById } from "../../utils/dom_helpers";
import { buildCategoryOptionsHtml } from "./category_options_html";

type GroupMode = "none" | "bank" | "day";

const BANK_OPTIONS: Bank[] = ["Nubank", "XP / Rico", "Santander"];

const BANK_BADGE_LABELS: Record<Bank, string> = {
  Nubank: "NU",
  "XP / Rico": "XP",
  Santander: "SAN",
};
const UNKNOWN_BANK_BADGE_LABEL = "?";

export function initEntryLists(): void {
  const periodSelect = getRequiredElementById<HTMLSelectElement>("transactions-period");
  const groupModeSelect = getRequiredElementById<HTMLSelectElement>("transactions-group-mode");
  const transactionList = getRequiredElementById<HTMLDivElement>("transaction-list");
  const incomeList = getRequiredElementById<HTMLDivElement>("income-entry-list");

  let transactions: StoredTransaction[] = [];
  let income: ManualIncomeEntry[] = [];
  let expenseCategories: Category[] = [];
  let incomeCategories: Category[] = [];
  let editingTransactionId: string | null = null;
  let editingIncomeId: string | null = null;
  let groupMode: GroupMode = "none";
  let possibleDuplicateTransactionIds = new Set<string>();
  let possibleDuplicateIncomeIds = new Set<string>();
  // a troca de categoria/banco de uma linha em edição grava sem redesenhar a lista,
  // para não perder o que já foi digitado nos outros campos
  let keepEditingRowOnNextReload = false;

  periodSelect.addEventListener("change", () => setSelectedPeriod(periodSelect.value));
  groupModeSelect.addEventListener("change", onGroupModeChange);
  listenSelectedPeriodChanged(onSelectedPeriodChange);
  listenStoredDataUpdated(() => void loadData());
  void loadData();

  async function loadData(): Promise<void> {
    [transactions, income, expenseCategories, incomeCategories] = await Promise.all([
      listTransactions(),
      listIncome(),
      listCategories("expense"),
      listCategories("income"),
    ]);

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
    editingTransactionId = null;
    editingIncomeId = null;
    renderLists();
  }

  function onGroupModeChange(): void {
    groupMode = groupModeSelect.value as GroupMode;
    editingTransactionId = null;
    editingIncomeId = null;
    renderLists();
  }

  function renderLists(): void {
    renderTransactionList();
    renderIncomeList();
  }

  function renderTransactionList(): void {
    const period = getSelectedPeriod();
    const rows = transactions
      .filter((transaction) => transaction.date.slice(0, 7) === period)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length === 0) {
      transactionList.innerHTML = `<p class="empty-state">Nenhuma transação neste período.</p>`;
      return;
    }

    // Calculado sobre o período inteiro, antes de agrupar: um par em grupos diferentes continua sinalizado.
    const duplicateGroups = groupPossibleDuplicateRows(rows);
    possibleDuplicateTransactionIds = new Set(duplicateGroups.flat().map((row) => row.id));

    transactionList.innerHTML = duplicateNoticeHtml(duplicateGroups) + groupedRowsHtml(rows, transactionRowsHtml);
    wireTransactionListEvents();
  }

  function renderIncomeList(): void {
    const period = getSelectedPeriod();
    const rows = income
      .filter((entry) => entry.date.slice(0, 7) === period)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length === 0) {
      incomeList.innerHTML = `<p class="empty-state">Nenhuma receita lançada neste período.</p>`;
      return;
    }

    const duplicateGroups = groupPossibleDuplicateRows(rows);
    possibleDuplicateIncomeIds = new Set(duplicateGroups.flat().map((row) => row.id));

    incomeList.innerHTML = duplicateNoticeHtml(duplicateGroups) + groupedRowsHtml(rows, incomeRowsHtml);
    wireIncomeListEvents();
  }

  function groupedRowsHtml<T extends { date: string; amount: number; bank?: Bank }>(
    rows: T[],
    rowsHtml: (rows: T[]) => string
  ): string {
    if (groupMode === "bank") return groupedListHtml(groupTransactionsByBank(rows), rowsHtml);
    if (groupMode === "day") return groupedListHtml(groupTransactionsByDay(rows), rowsHtml);
    return rowsHtml(rows);
  }

  function groupedListHtml<T>(groups: TransactionGroup<T>[], rowsHtml: (rows: T[]) => string): string {
    return groups
      .map(
        (group) => `
          <div class="transaction-group">
            <div class="transaction-group-header">
              <span>${escapeHtmlSpecialCharacters(groupHeaderLabel(group))}</span>
              <span class="transaction-group-subtotal">${formatBrlCurrency(group.total)}</span>
            </div>
            ${rowsHtml(group.transactions)}
          </div>
        `
      )
      .join("");
  }

  function groupHeaderLabel(group: TransactionGroup<unknown>): string {
    return groupMode === "day"
      ? new Date(`${group.key}T00:00:00`).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
        })
      : group.label;
  }

  function transactionRowsHtml(rows: StoredTransaction[]): string {
    return rows
      .map((row) => (row.id === editingTransactionId ? transactionEditRowHtml(row) : transactionViewRowHtml(row)))
      .join("");
  }

  function transactionViewRowHtml(row: StoredTransaction): string {
    const duplicate = possibleDuplicateRowAttributes(possibleDuplicateTransactionIds.has(row.id));
    return `
      <div class="transaction-row${duplicate.className}"${duplicate.title} data-id="${escapeHtmlSpecialCharacters(row.id)}">
        <span class="transaction-date">${escapeHtmlSpecialCharacters(row.date)}</span>
        ${bankBadgeHtml(row.bank)}
        <span class="transaction-description" title="${escapeHtmlSpecialCharacters(row.merchant)}">${escapeHtmlSpecialCharacters(row.merchant)}</span>
        <span class="transaction-amount">${formatBrlCurrency(row.amount)}</span>
        <select class="transaction-category-select">${buildCategoryOptionsHtml(expenseCategories, row.categoryId)}</select>
        <button type="button" class="link-button transaction-edit">Editar</button>
      </div>
    `;
  }

  function transactionEditRowHtml(row: StoredTransaction): string {
    return `
      <div class="transaction-row transaction-row-editing" data-id="${escapeHtmlSpecialCharacters(row.id)}">
        <div class="row-edit-line">
          <input type="date" class="transaction-edit-date" value="${escapeHtmlSpecialCharacters(row.date)}" />
          <select class="transaction-edit-bank" title="Banco de origem">${bankOptionsHtml(row.bank)}</select>
          <input type="text" class="transaction-edit-description" value="${escapeHtmlSpecialCharacters(row.merchant)}" />
          <input type="number" step="0.01" min="0.01" class="transaction-edit-amount" value="${escapeHtmlSpecialCharacters(String(row.amount))}" />
          <select class="transaction-category-select" title="Categoria">${buildCategoryOptionsHtml(expenseCategories, row.categoryId)}</select>
        </div>
        <div class="row-edit-actions">
          <button type="button" class="link-button transaction-save">Salvar</button>
          <button type="button" class="link-button transaction-cancel">Cancelar</button>
          <button type="button" class="link-button transaction-remove">Excluir</button>
        </div>
      </div>
    `;
  }

  function wireTransactionListEvents(): void {
    transactionList.querySelectorAll<HTMLButtonElement>(".duplicate-dismiss").forEach((button) => {
      button.addEventListener("click", async () => {
        await markTransactionIdListAsNotDuplicate(duplicateDismissIdList(button));
        notifyStoredDataUpdated();
      });
    });

    transactionList.querySelectorAll<HTMLSelectElement>(".transaction-category-select").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".transaction-row");
        if (!row?.dataset.id) return;

        await updateTransactionCategory(row.dataset.id, select.value);
        keepEditingRowOnNextReload = row.dataset.id === editingTransactionId;
        notifyStoredDataUpdated();
      });
    });

    transactionList.querySelectorAll<HTMLSelectElement>(".transaction-edit-bank").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".transaction-row");
        if (!row?.dataset.id) return;

        await updateTransactionBank(row.dataset.id, (select.value || undefined) as Bank | undefined);
        keepEditingRowOnNextReload = true;
        notifyStoredDataUpdated();
      });
    });

    transactionList.querySelectorAll<HTMLButtonElement>(".transaction-remove").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".transaction-row");
        if (!row?.dataset.id) return;

        const description =
          row.querySelector(".transaction-description")?.textContent ??
          row.querySelector<HTMLInputElement>(".transaction-edit-description")?.value ??
          "";
        if (!(await confirmAction(`Excluir a transação "${description}"?`))) return;

        await removeTransaction(row.dataset.id);
        editingTransactionId = null;
        notifyStoredDataUpdated();
      });
    });

    transactionList.querySelectorAll<HTMLButtonElement>(".transaction-edit").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest<HTMLElement>(".transaction-row");
        if (!row?.dataset.id) return;

        editingTransactionId = row.dataset.id;
        renderTransactionList();
      });
    });

    transactionList.querySelectorAll<HTMLButtonElement>(".transaction-cancel").forEach((button) => {
      button.addEventListener("click", () => {
        editingTransactionId = null;
        renderTransactionList();
      });
    });

    transactionList.querySelectorAll<HTMLButtonElement>(".transaction-save").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".transaction-row");
        if (!row?.dataset.id) return;

        const date = row.querySelector<HTMLInputElement>(".transaction-edit-date")?.value ?? "";
        const merchant = row.querySelector<HTMLInputElement>(".transaction-edit-description")?.value.trim() ?? "";
        const amount = parseFloat(row.querySelector<HTMLInputElement>(".transaction-edit-amount")?.value ?? "");
        if (!date || !merchant || Number.isNaN(amount) || amount <= 0) return;

        const original = transactions.find((transaction) => transaction.id === row.dataset.id);
        if (!original || date !== original.date || merchant !== original.merchant || amount !== original.amount) {
          await updateTransactionFields(row.dataset.id, { date, merchant, amount });
        }
        editingTransactionId = null;
        notifyStoredDataUpdated();
      });
    });
  }

  function incomeRowsHtml(rows: ManualIncomeEntry[]): string {
    return rows.map((row) => (row.id === editingIncomeId ? incomeEditRowHtml(row) : incomeViewRowHtml(row))).join("");
  }

  function incomeViewRowHtml(row: ManualIncomeEntry): string {
    const duplicate = possibleDuplicateRowAttributes(possibleDuplicateIncomeIds.has(row.id));
    return `
      <div class="manual-entry-row${duplicate.className}"${duplicate.title} data-id="${escapeHtmlSpecialCharacters(row.id)}">
        <span class="manual-entry-date">${escapeHtmlSpecialCharacters(row.date)}</span>
        ${bankBadgeHtml(row.bank)}
        <span class="manual-entry-description" title="${escapeHtmlSpecialCharacters(row.description)}">${escapeHtmlSpecialCharacters(row.description)}</span>
        <span class="manual-entry-amount income">${formatBrlCurrency(row.amount)}</span>
        <select class="income-category-select">${buildCategoryOptionsHtml(incomeCategories, row.categoryId)}</select>
        <button type="button" class="link-button income-edit">Editar</button>
      </div>
    `;
  }

  function incomeEditRowHtml(row: ManualIncomeEntry): string {
    return `
      <div class="manual-entry-row manual-entry-row-editing" data-id="${escapeHtmlSpecialCharacters(row.id)}">
        <div class="row-edit-line">
          <input type="date" class="manual-entry-edit-date" value="${escapeHtmlSpecialCharacters(row.date)}" />
          <select class="manual-entry-edit-bank" title="Banco de origem">${bankOptionsHtml(row.bank)}</select>
          <input type="text" class="manual-entry-edit-description" value="${escapeHtmlSpecialCharacters(row.description)}" />
          <input type="number" step="0.01" min="0.01" class="manual-entry-edit-amount" value="${escapeHtmlSpecialCharacters(String(row.amount))}" />
          <select class="income-category-select" title="Categoria">${buildCategoryOptionsHtml(incomeCategories, row.categoryId)}</select>
        </div>
        <div class="row-edit-actions">
          <button type="button" class="link-button income-save">Salvar</button>
          <button type="button" class="link-button income-cancel">Cancelar</button>
          <button type="button" class="link-button income-remove">Excluir</button>
        </div>
      </div>
    `;
  }

  function wireIncomeListEvents(): void {
    incomeList.querySelectorAll<HTMLButtonElement>(".duplicate-dismiss").forEach((button) => {
      button.addEventListener("click", async () => {
        await markIncomeIdListAsNotDuplicate(duplicateDismissIdList(button));
        notifyStoredDataUpdated();
      });
    });

    incomeList.querySelectorAll<HTMLSelectElement>(".income-category-select").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".manual-entry-row");
        if (!row?.dataset.id) return;

        await updateIncomeCategory(row.dataset.id, select.value);
        keepEditingRowOnNextReload = row.dataset.id === editingIncomeId;
        notifyStoredDataUpdated();
      });
    });

    incomeList.querySelectorAll<HTMLSelectElement>(".manual-entry-edit-bank").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".manual-entry-row");
        if (!row?.dataset.id) return;

        await updateIncomeBank(row.dataset.id, (select.value || undefined) as Bank | undefined);
        keepEditingRowOnNextReload = true;
        notifyStoredDataUpdated();
      });
    });

    incomeList.querySelectorAll<HTMLButtonElement>(".income-remove").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".manual-entry-row");
        if (!row?.dataset.id) return;

        const description =
          row.querySelector(".manual-entry-description")?.textContent ??
          row.querySelector<HTMLInputElement>(".manual-entry-edit-description")?.value ??
          "";
        if (!(await confirmAction(`Excluir a receita "${description}"?`))) return;

        await removeIncome(row.dataset.id);
        editingIncomeId = null;
        notifyStoredDataUpdated();
      });
    });

    incomeList.querySelectorAll<HTMLButtonElement>(".income-edit").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest<HTMLElement>(".manual-entry-row");
        if (!row?.dataset.id) return;

        editingIncomeId = row.dataset.id;
        renderIncomeList();
      });
    });

    incomeList.querySelectorAll<HTMLButtonElement>(".income-cancel").forEach((button) => {
      button.addEventListener("click", () => {
        editingIncomeId = null;
        renderIncomeList();
      });
    });

    incomeList.querySelectorAll<HTMLButtonElement>(".income-save").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".manual-entry-row");
        if (!row?.dataset.id) return;

        const date = row.querySelector<HTMLInputElement>(".manual-entry-edit-date")?.value ?? "";
        const description = row.querySelector<HTMLInputElement>(".manual-entry-edit-description")?.value.trim() ?? "";
        const amount = parseFloat(row.querySelector<HTMLInputElement>(".manual-entry-edit-amount")?.value ?? "");
        if (!date || !description || Number.isNaN(amount) || amount <= 0) return;

        const original = income.find((entry) => entry.id === row.dataset.id);
        if (!original || date !== original.date || description !== original.description || amount !== original.amount) {
          await updateIncomeFields(row.dataset.id, { date, description, amount });
        }
        editingIncomeId = null;
        notifyStoredDataUpdated();
      });
    });
  }
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
