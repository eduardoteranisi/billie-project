import { classifyTransactionDescription, UNCATEGORIZED_CATEGORY_ID, UNCATEGORIZED_INCOME_CATEGORY_ID } from "@billie/parser";
import type { Bank, Category, CategoryGroup, CategoryRule } from "@billie/parser";
import { calculateDre, listAvailablePeriods } from "../services/dre_aggregator";
import { groupPossibleDuplicateRows } from "../services/duplicate_detection";
import { groupTransactionsByBank, groupTransactionsByDay, UNKNOWN_BANK_LABEL } from "../services/transaction_grouping";
import type { TransactionGroup } from "../services/transaction_grouping";
import {
  BackupValidationError,
  countIncomeByCategory,
  countTransactionsByCategory,
  createCategory,
  deleteCategory,
  exportBackupData,
  listCategories,
  listCategoryRules,
  listIncome,
  listTransactions,
  markIncomeIdListAsNotDuplicate,
  markTransactionIdListAsNotDuplicate,
  removeIncome,
  removeTransaction,
  restoreBackupData,
  saveIncome,
  saveTransactions,
  updateCategory,
  updateIncomeBank,
  updateIncomeCategory,
  updateIncomeFields,
  updateTransactionBank,
  updateTransactionCategory,
  updateTransactionFields,
} from "../services/expense_store";
import type { CategoryType } from "../services/expense_store";
import type { CategorySummary, DreSummary, ManualIncomeEntry, StoredTransaction } from "../types";

export const EXPENSES_UPDATED_EVENT = "billie:expenses-updated";

const BANK_OPTIONS: Bank[] = ["Nubank", "XP / Rico", "Santander"];

const BANK_BADGE_LABELS: Record<Bank, string> = {
  Nubank: "NU",
  "XP / Rico": "XP",
  Santander: "SAN",
};
const UNKNOWN_BANK_BADGE_LABEL = "?";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (char) => entities[char]);
}

function setCardValue(el: HTMLElement, value: number): void {
  const text = formatCurrency(value);
  el.textContent = text;
  el.style.setProperty("--value-length", String(text.length));
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não encontrado`);
  return el as T;
}

function baixarArquivo(conteudo: string, nomeArquivo: string, tipo: string): void {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();

  URL.revokeObjectURL(url);
}

function nomeArquivoBackup(): string {
  return `billie-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export function initExpensesView(): void {
  const periodSelect = byId<HTMLSelectElement>("expenses-period");
  const incomeCard = byId<HTMLParagraphElement>("dre-income");
  const fixedCard = byId<HTMLParagraphElement>("dre-fixed");
  const variableCard = byId<HTMLParagraphElement>("dre-variable");
  const resultCard = byId<HTMLParagraphElement>("dre-result");
  const categoryList = byId<HTMLDivElement>("category-list");
  const incomeCategoryList = byId<HTMLDivElement>("income-category-list");
  const transactionsPeriodSelect = byId<HTMLSelectElement>("transactions-period");
  const transactionsGroupModeSelect = byId<HTMLSelectElement>("transactions-group-mode");
  const transactionList = byId<HTMLDivElement>("transaction-list");
  const incomeList = byId<HTMLDivElement>("income-entry-list");
  const btnAddIncome = byId<HTMLButtonElement>("btn-add-income");
  const incomeAddPopover = byId<HTMLDivElement>("income-add-popover");
  const incomeAddForm = byId<HTMLFormElement>("income-add-form");
  const incomeAddDate = byId<HTMLInputElement>("income-add-date");
  const incomeAddDescription = byId<HTMLInputElement>("income-add-description");
  const incomeAddCategory = byId<HTMLSelectElement>("income-add-category");
  const incomeAddAmount = byId<HTMLInputElement>("income-add-amount");
  const btnAddExpense = byId<HTMLButtonElement>("btn-add-expense");
  const expenseAddPopover = byId<HTMLDivElement>("expense-add-popover");
  const expenseAddForm = byId<HTMLFormElement>("expense-add-form");
  const expenseAddDate = byId<HTMLInputElement>("expense-add-date");
  const expenseAddDescription = byId<HTMLInputElement>("expense-add-description");
  const expenseAddCategory = byId<HTMLSelectElement>("expense-add-category");
  const expenseAddAmount = byId<HTMLInputElement>("expense-add-amount");
  const categoryTypeToggle = byId<HTMLDivElement>("category-type-toggle");
  const categoryManagerExpense = byId<HTMLDivElement>("category-manager-expense");
  const categoryManagerIncome = byId<HTMLDivElement>("category-manager-income");
  const categoryForm = byId<HTMLFormElement>("category-form");
  const categoryGroupField = byId<HTMLDivElement>("category-group-field");
  const categoryLabelInput = byId<HTMLInputElement>("category-label");
  const categoryGroupSelect = byId<HTMLSelectElement>("category-group");
  const categoryKeywordsInput = byId<HTMLInputElement>("category-keywords");
  const btnExportarBackup = byId<HTMLButtonElement>("btn-exportar-backup");
  const btnImportarBackup = byId<HTMLButtonElement>("btn-importar-backup");
  const backupFileInput = byId<HTMLInputElement>("backup-file-input");
  const backupStatus = byId<HTMLParagraphElement>("backup-status");
  const modalConfirm = byId<HTMLDivElement>("modal-confirm");
  const modalConfirmMessage = byId<HTMLParagraphElement>("modal-confirm-message");
  const modalConfirmConfirm = byId<HTMLButtonElement>("modal-confirm-confirm");
  const modalConfirmCancel = byId<HTMLButtonElement>("modal-confirm-cancel");

  let transactions: StoredTransaction[] = [];
  let income: ManualIncomeEntry[] = [];
  let expenseCategories: Category[] = [];
  let incomeCategories: Category[] = [];
  let expenseCategoryRules: CategoryRule[] = [];
  let incomeCategoryRules: CategoryRule[] = [];
  let editingTransactionId: string | null = null;
  let editingIncomeId: string | null = null;
  let activeCategoryManagerType: CategoryType = "expense";
  let incomeCategoryTouched = false;
  let expenseCategoryTouched = false;
  let transactionGroupMode: "none" | "bank" | "day" = "none";
  let possibleDuplicateTransactionIds = new Set<string>();
  let possibleDuplicateIncomeIds = new Set<string>();

  function confirmarAcao(mensagem: string): Promise<boolean> {
    modalConfirmMessage.textContent = mensagem;

    return new Promise((resolve) => {
      const finalizar = (resultado: boolean) => {
        modalConfirm.hidden = true;
        modalConfirmConfirm.removeEventListener("click", onConfirm);
        modalConfirmCancel.removeEventListener("click", onCancel);
        resolve(resultado);
      };
      const onConfirm = () => finalizar(true);
      const onCancel = () => finalizar(false);

      modalConfirmConfirm.addEventListener("click", onConfirm);
      modalConfirmCancel.addEventListener("click", onCancel);
      modalConfirm.hidden = false;
    });
  }

  async function loadData(): Promise<void> {
    [transactions, income, expenseCategories, incomeCategories, expenseCategoryRules, incomeCategoryRules] =
      await Promise.all([
        listTransactions(),
        listIncome(),
        listCategories("expense"),
        listCategories("income"),
        listCategoryRules("expense"),
        listCategoryRules("income"),
      ]);
    renderPeriodOptions();
    renderPeriod();
    renderCategoryManager();
    populateCategorySelect(incomeAddCategory, incomeCategories);
    populateCategorySelect(expenseAddCategory, expenseCategories);
  }

  function populateCategorySelect(select: HTMLSelectElement, categories: Category[]): void {
    const previousValue = select.value;
    select.innerHTML = categoryOptionsHtml(categories, previousValue);
    if (!select.value && categories.length > 0) select.value = categories[0].id;
  }

  function renderPeriodOptions(): void {
    const periods = listAvailablePeriods(transactions, income);
    const previousValue = periodSelect.value;
    const optionsHtml = periods.map((period) => `<option value="${period}">${period}</option>`).join("");

    periodSelect.innerHTML = optionsHtml;
    transactionsPeriodSelect.innerHTML = optionsHtml;

    const nextValue = periods.includes(previousValue) ? previousValue : (periods[0] ?? "");
    periodSelect.value = nextValue;
    transactionsPeriodSelect.value = nextValue;
  }

  function onPeriodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    periodSelect.value = value;
    transactionsPeriodSelect.value = value;
    editingTransactionId = null;
    editingIncomeId = null;
    renderPeriod();
  }

  function renderPeriod(): void {
    const period = periodSelect.value;
    renderDreSummary(period);
    renderTransactionList(period);
    renderIncomeList(period);
  }

  function renderDreSummary(period: string): void {
    const summary: DreSummary = period
      ? calculateDre(period, transactions, income, [...expenseCategories, ...incomeCategories])
      : {
          period: "",
          totalIncome: 0,
          fixedExpenses: 0,
          variableExpenses: 0,
          result: 0,
          expenseCategories: [],
          incomeCategories: [],
        };

    setCardValue(incomeCard, summary.totalIncome);
    setCardValue(fixedCard, summary.fixedExpenses);
    setCardValue(variableCard, summary.variableExpenses);
    setCardValue(resultCard, summary.result);
    resultCard.classList.toggle("negative", summary.result < 0);

    renderCategoryBreakdown(
      categoryList,
      summary.expenseCategories,
      "Nenhum gasto categorizado neste período.",
      summary.fixedExpenses + summary.variableExpenses
    );
    renderCategoryBreakdown(
      incomeCategoryList,
      summary.incomeCategories,
      "Nenhuma receita categorizada neste período.",
      summary.totalIncome
    );
  }

  function renderCategoryBreakdown(
    container: HTMLDivElement,
    summaries: CategorySummary[],
    emptyMessage: string,
    periodTotal: number
  ): void {
    if (summaries.length === 0) {
      container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
      return;
    }

    container.innerHTML = summaries
      .map((category) => {
        const barWidth = periodTotal > 0 ? Math.round((category.total / periodTotal) * 100) : 0;
        const fillGroupClass = category.group ? ` category-bar-fill-${category.group}` : "";
        return `
          <div class="category-row">
            <div class="category-row-header">
              <span>${escapeHtml(category.label)}</span>
              <span>${formatCurrency(category.total)}</span>
            </div>
            <div class="category-bar"><div class="category-bar-fill${fillGroupClass}" style="width: ${barWidth}%"></div></div>
          </div>
        `;
      })
      .join("");
  }

  function categoryOptionsHtml(categories: Category[], selectedCategoryId: string): string {
    return categories
      .map(
        (category) =>
          `<option value="${category.id}" ${category.id === selectedCategoryId ? "selected" : ""}>${escapeHtml(category.label)}</option>`
      )
      .join("");
  }

  function transactionRowsHtml(rows: StoredTransaction[]): string {
    return rows
      .map((row) => (row.id === editingTransactionId ? transactionEditRowHtml(row) : transactionViewRowHtml(row)))
      .join("");
  }

  function groupHeaderLabel(group: TransactionGroup<unknown>): string {
    return transactionGroupMode === "day"
      ? new Date(`${group.key}T00:00:00`).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
        })
      : group.label;
  }

  function groupedListHtml<T>(groups: TransactionGroup<T>[], rowsHtml: (rows: T[]) => string): string {
    return groups
      .map(
        (group) => `
          <div class="transaction-group">
            <div class="transaction-group-header">
              <span>${escapeHtml(groupHeaderLabel(group))}</span>
              <span class="transaction-group-subtotal">${formatCurrency(group.total)}</span>
            </div>
            ${rowsHtml(group.transactions)}
          </div>
        `
      )
      .join("");
  }

  function renderTransactionList(period: string): void {
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

    let listHtml: string;
    if (transactionGroupMode === "bank") {
      listHtml = groupedListHtml(groupTransactionsByBank(rows), transactionRowsHtml);
    } else if (transactionGroupMode === "day") {
      listHtml = groupedListHtml(groupTransactionsByDay(rows), transactionRowsHtml);
    } else {
      listHtml = transactionRowsHtml(rows);
    }
    transactionList.innerHTML = duplicateNoticeHtml(duplicateGroups) + listHtml;

    wireTransactionListEvents();
  }

  function onTransactionGroupModeChange(): void {
    transactionGroupMode = transactionsGroupModeSelect.value as "none" | "bank" | "day";
    editingTransactionId = null;
    editingIncomeId = null;
    renderTransactionList(periodSelect.value);
    renderIncomeList(periodSelect.value);
  }

  function bankOptionsHtml(selectedBank: Bank | undefined): string {
    const unknownOption = `<option value="" ${selectedBank ? "" : "selected"}>${escapeHtml(UNKNOWN_BANK_LABEL)}</option>`;
    const bankOptions = BANK_OPTIONS.map(
      (bank) => `<option value="${escapeHtml(bank)}" ${bank === selectedBank ? "selected" : ""}>${escapeHtml(bank)}</option>`
    );
    return [unknownOption, ...bankOptions].join("");
  }

  function bankBadgeHtml(bank: Bank | undefined): string {
    const label = bank ? BANK_BADGE_LABELS[bank] : UNKNOWN_BANK_BADGE_LABEL;
    const title = bank ?? UNKNOWN_BANK_LABEL;
    return `<span class="bank-badge${bank ? "" : " bank-badge-unknown"}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
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
            <span>${dateLabel} · ${formatCurrency(amount)} · ${group.length} lançamentos</span>
            <button type="button" class="link-button duplicate-dismiss" data-ids="${escapeHtml(ids)}">Não é duplicado</button>
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

  function wireTransactionListEvents(): void {
    transactionList.querySelectorAll<HTMLButtonElement>(".duplicate-dismiss").forEach((button) => {
      button.addEventListener("click", async () => {
        await markTransactionIdListAsNotDuplicate(duplicateDismissIdList(button));
        await loadData();
      });
    });

    transactionList.querySelectorAll<HTMLSelectElement>(".transaction-category-select").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".transaction-row");
        if (!row?.dataset.id) return;

        await updateTransactionCategory(row.dataset.id, select.value);

        const transaction = transactions.find((candidate) => candidate.id === row.dataset.id);
        if (transaction && row.dataset.id === editingTransactionId) {
          // Sem recarregar a lista: preserva o que já foi digitado nos outros campos da edição.
          transaction.categoryId = select.value;
          transaction.categoryOverridden = true;
          renderDreSummary(periodSelect.value);
          return;
        }
        await loadData();
      });
    });

    transactionList.querySelectorAll<HTMLSelectElement>(".transaction-edit-bank").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".transaction-row");
        const transaction = transactions.find((candidate) => candidate.id === row?.dataset.id);
        if (!transaction) return;

        // Sem recarregar a lista: preserva o que já foi digitado nos outros campos da edição.
        const bank = (select.value || undefined) as Bank | undefined;
        await updateTransactionBank(transaction.id, bank);
        transaction.bank = bank;
        transaction.bankOverridden = true;
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
        if (!(await confirmarAcao(`Excluir a transação "${description}"?`))) return;

        await removeTransaction(row.dataset.id);
        editingTransactionId = null;
        await loadData();
      });
    });

    transactionList.querySelectorAll<HTMLButtonElement>(".transaction-edit").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest<HTMLElement>(".transaction-row");
        if (!row?.dataset.id) return;

        editingTransactionId = row.dataset.id;
        renderTransactionList(periodSelect.value);
      });
    });

    transactionList.querySelectorAll<HTMLButtonElement>(".transaction-cancel").forEach((button) => {
      button.addEventListener("click", () => {
        editingTransactionId = null;
        renderTransactionList(periodSelect.value);
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
        await loadData();
      });
    });
  }

  function transactionViewRowHtml(row: StoredTransaction): string {
    const duplicate = possibleDuplicateRowAttributes(possibleDuplicateTransactionIds.has(row.id));
    return `
      <div class="transaction-row${duplicate.className}"${duplicate.title} data-id="${row.id}">
        <span class="transaction-date">${row.date}</span>
        ${bankBadgeHtml(row.bank)}
        <span class="transaction-description" title="${escapeHtml(row.merchant)}">${escapeHtml(row.merchant)}</span>
        <span class="transaction-amount">${formatCurrency(row.amount)}</span>
        <select class="transaction-category-select">${categoryOptionsHtml(expenseCategories, row.categoryId)}</select>
        <button type="button" class="link-button transaction-edit">Editar</button>
      </div>
    `;
  }

  function transactionEditRowHtml(row: StoredTransaction): string {
    return `
      <div class="transaction-row transaction-row-editing" data-id="${row.id}">
        <div class="row-edit-line">
          <input type="date" class="transaction-edit-date" value="${row.date}" />
          <select class="transaction-edit-bank" title="Banco de origem">${bankOptionsHtml(row.bank)}</select>
          <input type="text" class="transaction-edit-description" value="${escapeHtml(row.merchant)}" />
          <input type="number" step="0.01" min="0.01" class="transaction-edit-amount" value="${row.amount}" />
          <select class="transaction-category-select" title="Categoria">${categoryOptionsHtml(expenseCategories, row.categoryId)}</select>
        </div>
        <div class="row-edit-actions">
          <button type="button" class="link-button transaction-save">Salvar</button>
          <button type="button" class="link-button transaction-cancel">Cancelar</button>
          <button type="button" class="link-button transaction-remove">Excluir</button>
        </div>
      </div>
    `;
  }

  function incomeRowsHtml(rows: ManualIncomeEntry[]): string {
    return rows.map((row) => (row.id === editingIncomeId ? incomeEditRowHtml(row) : incomeViewRowHtml(row))).join("");
  }

  function renderIncomeList(period: string): void {
    const rows = income
      .filter((entry) => entry.date.slice(0, 7) === period)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length === 0) {
      incomeList.innerHTML = `<p class="empty-state">Nenhuma receita lançada neste período.</p>`;
      return;
    }

    const duplicateGroups = groupPossibleDuplicateRows(rows);
    possibleDuplicateIncomeIds = new Set(duplicateGroups.flat().map((row) => row.id));

    let listHtml: string;
    if (transactionGroupMode === "bank") {
      listHtml = groupedListHtml(groupTransactionsByBank(rows), incomeRowsHtml);
    } else if (transactionGroupMode === "day") {
      listHtml = groupedListHtml(groupTransactionsByDay(rows), incomeRowsHtml);
    } else {
      listHtml = incomeRowsHtml(rows);
    }
    incomeList.innerHTML = duplicateNoticeHtml(duplicateGroups) + listHtml;

    wireIncomeListEvents();
  }

  function wireIncomeListEvents(): void {
    incomeList.querySelectorAll<HTMLButtonElement>(".duplicate-dismiss").forEach((button) => {
      button.addEventListener("click", async () => {
        await markIncomeIdListAsNotDuplicate(duplicateDismissIdList(button));
        await loadData();
      });
    });

    incomeList.querySelectorAll<HTMLSelectElement>(".income-category-select").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".manual-entry-row");
        if (!row?.dataset.id) return;

        await updateIncomeCategory(row.dataset.id, select.value);

        const entry = income.find((candidate) => candidate.id === row.dataset.id);
        if (entry && row.dataset.id === editingIncomeId) {
          // Sem recarregar a lista: preserva o que já foi digitado nos outros campos da edição.
          entry.categoryId = select.value;
          entry.categoryOverridden = true;
          renderDreSummary(periodSelect.value);
          return;
        }
        await loadData();
      });
    });

    incomeList.querySelectorAll<HTMLSelectElement>(".manual-entry-edit-bank").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".manual-entry-row");
        const entry = income.find((candidate) => candidate.id === row?.dataset.id);
        if (!entry) return;

        // Sem recarregar a lista: preserva o que já foi digitado nos outros campos da edição.
        const bank = (select.value || undefined) as Bank | undefined;
        await updateIncomeBank(entry.id, bank);
        entry.bank = bank;
        entry.bankOverridden = true;
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
        if (!(await confirmarAcao(`Excluir a receita "${description}"?`))) return;

        await removeIncome(row.dataset.id);
        editingIncomeId = null;
        await loadData();
      });
    });

    incomeList.querySelectorAll<HTMLButtonElement>(".income-edit").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest<HTMLElement>(".manual-entry-row");
        if (!row?.dataset.id) return;

        editingIncomeId = row.dataset.id;
        renderIncomeList(periodSelect.value);
      });
    });

    incomeList.querySelectorAll<HTMLButtonElement>(".income-cancel").forEach((button) => {
      button.addEventListener("click", () => {
        editingIncomeId = null;
        renderIncomeList(periodSelect.value);
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
        await loadData();
      });
    });
  }

  function incomeViewRowHtml(row: ManualIncomeEntry): string {
    const duplicate = possibleDuplicateRowAttributes(possibleDuplicateIncomeIds.has(row.id));
    return `
      <div class="manual-entry-row${duplicate.className}"${duplicate.title} data-id="${row.id}">
        <span class="manual-entry-date">${row.date}</span>
        ${bankBadgeHtml(row.bank)}
        <span class="manual-entry-description" title="${escapeHtml(row.description)}">${escapeHtml(row.description)}</span>
        <span class="manual-entry-amount income">${formatCurrency(row.amount)}</span>
        <select class="income-category-select">${categoryOptionsHtml(incomeCategories, row.categoryId)}</select>
        <button type="button" class="link-button income-edit">Editar</button>
      </div>
    `;
  }

  function incomeEditRowHtml(row: ManualIncomeEntry): string {
    return `
      <div class="manual-entry-row manual-entry-row-editing" data-id="${row.id}">
        <div class="row-edit-line">
          <input type="date" class="manual-entry-edit-date" value="${row.date}" />
          <select class="manual-entry-edit-bank" title="Banco de origem">${bankOptionsHtml(row.bank)}</select>
          <input type="text" class="manual-entry-edit-description" value="${escapeHtml(row.description)}" />
          <input type="number" step="0.01" min="0.01" class="manual-entry-edit-amount" value="${row.amount}" />
          <select class="income-category-select" title="Categoria">${categoryOptionsHtml(incomeCategories, row.categoryId)}</select>
        </div>
        <div class="row-edit-actions">
          <button type="button" class="link-button income-save">Salvar</button>
          <button type="button" class="link-button income-cancel">Cancelar</button>
          <button type="button" class="link-button income-remove">Excluir</button>
        </div>
      </div>
    `;
  }

  function renderCategoryManager(): void {
    renderCategoryManagerPanel(categoryManagerExpense, "expense", expenseCategories, expenseCategoryRules);
    renderCategoryManagerPanel(categoryManagerIncome, "income", incomeCategories, incomeCategoryRules);
  }

  function renderCategoryManagerPanel(
    container: HTMLDivElement,
    type: CategoryType,
    categories: Category[],
    rules: CategoryRule[]
  ): void {
    const uncategorizedId = type === "expense" ? UNCATEGORIZED_CATEGORY_ID : UNCATEGORIZED_INCOME_CATEGORY_ID;

    container.innerHTML = categories
      .filter((category) => category.id !== uncategorizedId)
      .map((category) => {
        const rule = rules.find((r) => r.categoryId === category.id);
        const keywords = (rule?.keywords ?? []).join(", ");
        const groupSelectHtml =
          category.type === "expense"
            ? `
              <select class="category-manager-group">
                <option value="variable" ${category.group === "variable" ? "selected" : ""}>Variável</option>
                <option value="fixed" ${category.group === "fixed" ? "selected" : ""}>Fixo</option>
              </select>
            `
            : "";

        return `
          <div class="category-manager-row" data-id="${category.id}" data-type="${type}">
            <input type="text" class="category-manager-label" value="${escapeHtml(category.label)}" />
            ${groupSelectHtml}
            <input
              type="text"
              class="category-manager-keywords"
              value="${escapeHtml(keywords)}"
              placeholder="palavras-chave separadas por vírgula"
            />
            <button type="button" class="link-button category-manager-delete">Excluir</button>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll<HTMLInputElement>(".category-manager-label").forEach((input) => {
      input.addEventListener("change", async () => {
        const id = input.closest<HTMLElement>(".category-manager-row")?.dataset.id;
        if (!id) return;

        await updateCategory(id, { label: input.value.trim() });
        await loadData();
      });
    });

    container.querySelectorAll<HTMLSelectElement>(".category-manager-group").forEach((select) => {
      select.addEventListener("change", async () => {
        const id = select.closest<HTMLElement>(".category-manager-row")?.dataset.id;
        if (!id) return;

        await updateCategory(id, { group: select.value as CategoryGroup });
        await loadData();
      });
    });

    container.querySelectorAll<HTMLInputElement>(".category-manager-keywords").forEach((input) => {
      input.addEventListener("change", async () => {
        const id = input.closest<HTMLElement>(".category-manager-row")?.dataset.id;
        if (!id) return;

        const keywords = input.value
          .split(",")
          .map((keyword) => keyword.trim())
          .filter((keyword) => keyword.length > 0);
        await updateCategory(id, { keywords });
        await loadData();
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".category-manager-delete").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".category-manager-row");
        const id = row?.dataset.id;
        if (!id) return;

        const label = row?.querySelector<HTMLInputElement>(".category-manager-label")?.value ?? "";
        const count = type === "expense" ? await countTransactionsByCategory(id) : await countIncomeByCategory(id);
        const confirmMessage =
          count > 0
            ? `Excluir "${label}"? ${count} lançamento(s) serão movidos para "Outros / Não categorizado".`
            : `Excluir "${label}"?`;

        if (!(await confirmarAcao(confirmMessage))) return;

        await deleteCategory(id);
        await loadData();
      });
    });
  }

  function setActiveCategoryManagerType(type: CategoryType): void {
    activeCategoryManagerType = type;

    categoryTypeToggle.querySelectorAll<HTMLButtonElement>(".category-type-toggle-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.type === type);
    });

    categoryManagerExpense.hidden = type !== "expense";
    categoryManagerIncome.hidden = type !== "income";
    categoryGroupField.hidden = type !== "expense";
    categoryKeywordsInput.placeholder = type === "expense" ? "ex.: UBER, 99APP" : "ex.: SALARIO, FREELANCE";
  }

  function wirePopover(trigger: HTMLButtonElement, popover: HTMLElement, onOpen?: () => void): void {
    trigger.addEventListener("click", () => {
      const willOpen = popover.hidden;
      popover.hidden = !popover.hidden;
      if (willOpen) onOpen?.();
    });
    document.addEventListener("click", (event) => {
      if (popover.hidden) return;
      const target = event.target as Node;
      if (popover.contains(target) || trigger.contains(target)) return;
      popover.hidden = true;
    });
  }

  async function onIncomeAddSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const date = incomeAddDate.value;
    const description = incomeAddDescription.value.trim();
    const amount = parseFloat(incomeAddAmount.value);
    if (!date || !description || Number.isNaN(amount) || amount <= 0) return;

    const entry: ManualIncomeEntry = {
      id: crypto.randomUUID(),
      date,
      description,
      amount,
      categoryId: incomeAddCategory.value,
    };
    await saveIncome(entry);

    incomeAddForm.reset();
    incomeAddPopover.hidden = true;
    await loadData();
  }

  async function onExpenseAddSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const date = expenseAddDate.value;
    const merchant = expenseAddDescription.value.trim();
    const amount = parseFloat(expenseAddAmount.value);
    if (!date || !merchant || Number.isNaN(amount) || amount <= 0) return;

    const entry: StoredTransaction = {
      id: crypto.randomUUID(),
      date,
      merchant,
      amount,
      categoryId: expenseAddCategory.value,
      origin: "manual",
    };
    await saveTransactions([entry]);

    expenseAddForm.reset();
    expenseAddPopover.hidden = true;
    await loadData();
  }

  async function onCategorySubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const label = categoryLabelInput.value.trim();
    if (!label) return;

    const keywords = categoryKeywordsInput.value
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    await createCategory({
      label,
      type: activeCategoryManagerType,
      group: activeCategoryManagerType === "expense" ? (categoryGroupSelect.value as CategoryGroup) : undefined,
      keywords,
    });

    categoryForm.reset();
    await loadData();
  }

  function exibirStatusBackup(mensagem: string, tipo: "success" | "error"): void {
    backupStatus.textContent = mensagem;
    backupStatus.classList.toggle("success", tipo === "success");
    backupStatus.classList.toggle("error", tipo === "error");
    backupStatus.hidden = false;
  }

  async function onExportarBackupClick(): Promise<void> {
    const payload = await exportBackupData();
    const nomeArquivo = nomeArquivoBackup();
    baixarArquivo(JSON.stringify(payload, null, 2), nomeArquivo, "application/json");
    exibirStatusBackup(`Backup exportado: ${nomeArquivo}`, "success");
  }

  async function onBackupFileSelected(): Promise<void> {
    const arquivo = backupFileInput.files?.[0];
    backupFileInput.value = "";
    if (!arquivo) return;

    backupStatus.hidden = true;

    let payload: unknown;
    try {
      payload = JSON.parse(await arquivo.text());
    } catch {
      exibirStatusBackup("Arquivo inválido: não é um JSON válido.", "error");
      return;
    }

    const confirmado = await confirmarAcao(
      "Restaurar este backup? Lançamentos e categorias com o mesmo identificador do arquivo serão sobrescritos; o restante dos dados atuais é preservado."
    );
    if (!confirmado) return;

    try {
      await restoreBackupData(payload);
      await loadData();
      exibirStatusBackup("Backup restaurado com sucesso.", "success");
    } catch (error) {
      const mensagem = error instanceof BackupValidationError ? error.message : "Não foi possível restaurar o backup.";
      exibirStatusBackup(mensagem, "error");
    }
  }

  periodSelect.addEventListener("change", onPeriodChange);
  transactionsPeriodSelect.addEventListener("change", onPeriodChange);
  transactionsGroupModeSelect.addEventListener("change", onTransactionGroupModeChange);
  incomeAddForm.addEventListener("submit", onIncomeAddSubmit);
  expenseAddForm.addEventListener("submit", onExpenseAddSubmit);
  wirePopover(btnAddIncome, incomeAddPopover, () => {
    incomeAddForm.reset();
    incomeCategoryTouched = false;
    incomeAddCategory.value = UNCATEGORIZED_INCOME_CATEGORY_ID;
  });
  wirePopover(btnAddExpense, expenseAddPopover, () => {
    expenseAddForm.reset();
    expenseCategoryTouched = false;
    expenseAddCategory.value = UNCATEGORIZED_CATEGORY_ID;
  });
  incomeAddDescription.addEventListener("input", () => {
    if (incomeCategoryTouched) return;
    incomeAddCategory.value = classifyTransactionDescription(
      incomeAddDescription.value,
      incomeCategoryRules,
      UNCATEGORIZED_INCOME_CATEGORY_ID
    );
  });
  expenseAddDescription.addEventListener("input", () => {
    if (expenseCategoryTouched) return;
    expenseAddCategory.value = classifyTransactionDescription(expenseAddDescription.value, expenseCategoryRules);
  });
  incomeAddCategory.addEventListener("change", () => { incomeCategoryTouched = true; });
  expenseAddCategory.addEventListener("change", () => { expenseCategoryTouched = true; });
  categoryTypeToggle.querySelectorAll<HTMLButtonElement>(".category-type-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => setActiveCategoryManagerType(button.dataset.type as CategoryType));
  });
  categoryForm.addEventListener("submit", onCategorySubmit);
  btnExportarBackup.addEventListener("click", () => void onExportarBackupClick());
  btnImportarBackup.addEventListener("click", () => backupFileInput.click());
  backupFileInput.addEventListener("change", () => void onBackupFileSelected());
  document.addEventListener(EXPENSES_UPDATED_EVENT, () => void loadData());

  void loadData();
}
