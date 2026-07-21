import { classifyTransactionDescription, UNCATEGORIZED_CATEGORY_ID } from "@billie/parser";
import type { Category, CategoryGroup, CategoryRule } from "@billie/parser";
import { calculateDre, listAvailablePeriods } from "../services/dre_aggregator";
import {
  countTransactionsByCategory,
  createCategory,
  deleteCategory,
  listCategories,
  listCategoryRules,
  listIncome,
  listTransactions,
  removeIncome,
  removeTransaction,
  saveIncome,
  saveTransactions,
  updateCategory,
  updateTransactionCategory,
  updateTransactionFields,
} from "../services/expense_store";
import type { DreSummary, ManualIncomeEntry, StoredTransaction } from "../types";

export const EXPENSES_UPDATED_EVENT = "billie:expenses-updated";

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

export function initExpensesView(): void {
  const periodSelect = byId<HTMLSelectElement>("expenses-period");
  const incomeCard = byId<HTMLParagraphElement>("dre-income");
  const fixedCard = byId<HTMLParagraphElement>("dre-fixed");
  const variableCard = byId<HTMLParagraphElement>("dre-variable");
  const resultCard = byId<HTMLParagraphElement>("dre-result");
  const categoryList = byId<HTMLDivElement>("category-list");
  const transactionsPeriodSelect = byId<HTMLSelectElement>("transactions-period");
  const transactionList = byId<HTMLDivElement>("transaction-list");
  const manualForm = byId<HTMLFormElement>("manual-entry-form");
  const manualType = byId<HTMLSelectElement>("manual-type");
  const manualDate = byId<HTMLInputElement>("manual-date");
  const manualDescription = byId<HTMLInputElement>("manual-description");
  const manualAmount = byId<HTMLInputElement>("manual-amount");
  const incomeList = byId<HTMLDivElement>("income-entry-list");
  const categoryManager = byId<HTMLDivElement>("category-manager");
  const categoryForm = byId<HTMLFormElement>("category-form");
  const categoryLabelInput = byId<HTMLInputElement>("category-label");
  const categoryGroupSelect = byId<HTMLSelectElement>("category-group");
  const categoryKeywordsInput = byId<HTMLInputElement>("category-keywords");

  let transactions: StoredTransaction[] = [];
  let income: ManualIncomeEntry[] = [];
  let categories: Category[] = [];
  let categoryRules: CategoryRule[] = [];
  let editingTransactionId: string | null = null;

  async function loadData(): Promise<void> {
    [transactions, income, categories, categoryRules] = await Promise.all([
      listTransactions(),
      listIncome(),
      listCategories(),
      listCategoryRules(),
    ]);
    renderPeriodOptions();
    renderPeriod();
    renderCategoryManager();
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
    renderPeriod();
  }

  function renderPeriod(): void {
    const period = periodSelect.value;
    const summary: DreSummary = period
      ? calculateDre(period, transactions, income, categories)
      : { period: "", totalIncome: 0, fixedExpenses: 0, variableExpenses: 0, result: 0, categories: [] };

    setCardValue(incomeCard, summary.totalIncome);
    setCardValue(fixedCard, summary.fixedExpenses);
    setCardValue(variableCard, summary.variableExpenses);
    setCardValue(resultCard, summary.result);
    resultCard.classList.toggle("negative", summary.result < 0);

    renderCategories(summary);
    renderTransactionList(period);
    renderIncomeList(period);
  }

  function renderCategories(summary: DreSummary): void {
    if (summary.categories.length === 0) {
      categoryList.innerHTML = `<p class="empty-state">Nenhum gasto categorizado neste período.</p>`;
      return;
    }

    const maxTotal = summary.categories[0].total;

    categoryList.innerHTML = summary.categories
      .map((category) => {
        const barWidth = maxTotal > 0 ? Math.round((category.total / maxTotal) * 100) : 0;
        return `
          <div class="category-row">
            <div class="category-row-header">
              <span>${escapeHtml(category.label)}</span>
              <span>${formatCurrency(category.total)}</span>
            </div>
            <div class="category-bar"><div class="category-bar-fill" style="width: ${barWidth}%"></div></div>
          </div>
        `;
      })
      .join("");
  }

  function categoryOptionsHtml(selectedCategoryId: string): string {
    return categories
      .map(
        (category) =>
          `<option value="${category.id}" ${category.id === selectedCategoryId ? "selected" : ""}>${escapeHtml(category.label)}</option>`
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

    transactionList.innerHTML = rows
      .map((row) => (row.id === editingTransactionId ? transactionEditRowHtml(row) : transactionViewRowHtml(row)))
      .join("");

    transactionList.querySelectorAll<HTMLSelectElement>(".transaction-category-select").forEach((select) => {
      select.addEventListener("change", async () => {
        const row = select.closest<HTMLElement>(".transaction-row");
        if (!row?.dataset.id) return;

        await updateTransactionCategory(row.dataset.id, select.value);
        await loadData();
      });
    });

    transactionList.querySelectorAll<HTMLButtonElement>(".transaction-remove").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".transaction-row");
        if (!row?.dataset.id) return;

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

        await updateTransactionFields(row.dataset.id, { date, merchant, amount });
        editingTransactionId = null;
        await loadData();
      });
    });
  }

  function transactionViewRowHtml(row: StoredTransaction): string {
    return `
      <div class="transaction-row" data-id="${row.id}">
        <span class="transaction-date">${row.date}</span>
        <span class="transaction-description" title="${escapeHtml(row.merchant)}">${escapeHtml(row.merchant)}</span>
        <span class="transaction-amount">${formatCurrency(row.amount)}</span>
        <select class="transaction-category-select">${categoryOptionsHtml(row.categoryId)}</select>
        <button type="button" class="link-button transaction-edit">Editar</button>
      </div>
    `;
  }

  function transactionEditRowHtml(row: StoredTransaction): string {
    return `
      <div class="transaction-row transaction-row-editing" data-id="${row.id}">
        <input type="date" class="transaction-edit-date" value="${row.date}" />
        <input type="text" class="transaction-edit-description" value="${escapeHtml(row.merchant)}" />
        <input type="number" step="0.01" min="0.01" class="transaction-edit-amount" value="${row.amount}" />
        <select class="transaction-category-select">${categoryOptionsHtml(row.categoryId)}</select>
        <button type="button" class="link-button transaction-save">Salvar</button>
        <button type="button" class="link-button transaction-cancel">Cancelar</button>
        ${row.origin === "manual" ? `<button type="button" class="link-button transaction-remove">Remover</button>` : ""}
      </div>
    `;
  }

  function renderIncomeList(period: string): void {
    const rows = income
      .filter((entry) => entry.date.slice(0, 7) === period)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length === 0) {
      incomeList.innerHTML = `<p class="empty-state">Nenhuma receita lançada neste período.</p>`;
      return;
    }

    incomeList.innerHTML = rows
      .map(
        (row) => `
          <div class="manual-entry-row" data-id="${row.id}">
            <span class="manual-entry-date">${row.date}</span>
            <span class="manual-entry-description">${escapeHtml(row.description)}</span>
            <span class="manual-entry-amount income">+ ${formatCurrency(row.amount)}</span>
            <button type="button" class="link-button income-remove">Remover</button>
          </div>
        `
      )
      .join("");

    incomeList.querySelectorAll<HTMLButtonElement>(".income-remove").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".manual-entry-row");
        if (!row?.dataset.id) return;

        await removeIncome(row.dataset.id);
        await loadData();
      });
    });
  }

  function renderCategoryManager(): void {
    categoryManager.innerHTML = categories
      .filter((category) => category.id !== UNCATEGORIZED_CATEGORY_ID)
      .map((category) => {
        const rule = categoryRules.find((r) => r.categoryId === category.id);
        const keywords = (rule?.keywords ?? []).join(", ");

        return `
          <div class="category-manager-row" data-id="${category.id}">
            <input type="text" class="category-manager-label" value="${escapeHtml(category.label)}" />
            <select class="category-manager-group">
              <option value="variable" ${category.group === "variable" ? "selected" : ""}>Variável</option>
              <option value="fixed" ${category.group === "fixed" ? "selected" : ""}>Fixo</option>
            </select>
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

    categoryManager.querySelectorAll<HTMLInputElement>(".category-manager-label").forEach((input) => {
      input.addEventListener("change", async () => {
        const id = input.closest<HTMLElement>(".category-manager-row")?.dataset.id;
        if (!id) return;

        await updateCategory(id, { label: input.value.trim() });
        await loadData();
      });
    });

    categoryManager.querySelectorAll<HTMLSelectElement>(".category-manager-group").forEach((select) => {
      select.addEventListener("change", async () => {
        const id = select.closest<HTMLElement>(".category-manager-row")?.dataset.id;
        if (!id) return;

        await updateCategory(id, { group: select.value as CategoryGroup });
        await loadData();
      });
    });

    categoryManager.querySelectorAll<HTMLInputElement>(".category-manager-keywords").forEach((input) => {
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

    categoryManager.querySelectorAll<HTMLButtonElement>(".category-manager-delete").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".category-manager-row");
        const id = row?.dataset.id;
        if (!id) return;

        const label = row?.querySelector<HTMLInputElement>(".category-manager-label")?.value ?? "";
        const count = await countTransactionsByCategory(id);
        const confirmMessage =
          count > 0
            ? `Excluir "${label}"? ${count} transação(ões) serão movidas para "Outros / Não categorizado".`
            : `Excluir "${label}"?`;

        if (!window.confirm(confirmMessage)) return;

        await deleteCategory(id);
        await loadData();
      });
    });
  }

  async function onManualSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const date = manualDate.value;
    const description = manualDescription.value.trim();
    const amount = parseFloat(manualAmount.value);
    if (!date || !description || Number.isNaN(amount) || amount <= 0) return;

    if (manualType.value === "income") {
      const entry: ManualIncomeEntry = { id: crypto.randomUUID(), date, description, amount };
      await saveIncome(entry);
    } else {
      const entry: StoredTransaction = {
        id: crypto.randomUUID(),
        date,
        merchant: description,
        amount,
        categoryId: classifyTransactionDescription(description, categoryRules),
        origin: "manual",
      };
      await saveTransactions([entry]);
    }

    manualForm.reset();
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

    await createCategory({ label, group: categoryGroupSelect.value as CategoryGroup, keywords });

    categoryForm.reset();
    await loadData();
  }

  periodSelect.addEventListener("change", onPeriodChange);
  transactionsPeriodSelect.addEventListener("change", onPeriodChange);
  manualForm.addEventListener("submit", onManualSubmit);
  categoryForm.addEventListener("submit", onCategorySubmit);
  document.addEventListener(EXPENSES_UPDATED_EVENT, () => void loadData());

  void loadData();
}
