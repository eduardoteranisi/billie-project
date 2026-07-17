import { classifyTransaction } from "@billie/parser";
import { calculateDre, listAvailablePeriods } from "../services/dre_aggregator";
import {
  listIncome,
  listTransactions,
  removeIncome,
  removeTransaction,
  saveIncome,
  saveTransactions,
} from "../services/expense_store";
import type { DreSummary, ManualIncomeEntry, StoredTransaction } from "../types";

export const EXPENSES_UPDATED_EVENT = "billie:expenses-updated";

interface ManualEntryRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  kind: "income" | "expense";
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  const manualForm = byId<HTMLFormElement>("manual-entry-form");
  const manualType = byId<HTMLSelectElement>("manual-type");
  const manualDate = byId<HTMLInputElement>("manual-date");
  const manualDescription = byId<HTMLInputElement>("manual-description");
  const manualAmount = byId<HTMLInputElement>("manual-amount");
  const manualList = byId<HTMLDivElement>("manual-entry-list");

  let transactions: StoredTransaction[] = [];
  let income: ManualIncomeEntry[] = [];

  async function loadData(): Promise<void> {
    [transactions, income] = await Promise.all([listTransactions(), listIncome()]);
    renderPeriodOptions();
    renderPeriod();
  }

  function renderPeriodOptions(): void {
    const periods = listAvailablePeriods(transactions, income);
    const previousValue = periodSelect.value;

    periodSelect.innerHTML = periods.map((period) => `<option value="${period}">${period}</option>`).join("");

    if (periods.includes(previousValue)) {
      periodSelect.value = previousValue;
    } else if (periods.length > 0) {
      periodSelect.value = periods[0];
    }
  }

  function renderPeriod(): void {
    const period = periodSelect.value;
    const summary: DreSummary = period
      ? calculateDre(period, transactions, income)
      : { period: "", totalIncome: 0, fixedExpenses: 0, variableExpenses: 0, result: 0, categories: [] };

    incomeCard.textContent = formatCurrency(summary.totalIncome);
    fixedCard.textContent = formatCurrency(summary.fixedExpenses);
    variableCard.textContent = formatCurrency(summary.variableExpenses);
    resultCard.textContent = formatCurrency(summary.result);
    resultCard.classList.toggle("negative", summary.result < 0);

    renderCategories(summary);
    renderManualEntries(period);
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
              <span>${category.label}</span>
              <span>${formatCurrency(category.total)}</span>
            </div>
            <div class="category-bar"><div class="category-bar-fill" style="width: ${barWidth}%"></div></div>
          </div>
        `;
      })
      .join("");
  }

  function renderManualEntries(period: string): void {
    const rows: ManualEntryRow[] = [
      ...income
        .filter((entry) => entry.date.slice(0, 7) === period)
        .map((entry) => ({ ...entry, kind: "income" as const })),
      ...transactions
        .filter((transaction) => transaction.origin === "manual" && transaction.date.slice(0, 7) === period)
        .map((transaction) => ({
          id: transaction.id,
          date: transaction.date,
          description: transaction.merchant,
          amount: transaction.amount,
          kind: "expense" as const,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length === 0) {
      manualList.innerHTML = `<p class="empty-state">Nenhum lançamento manual neste período.</p>`;
      return;
    }

    manualList.innerHTML = rows
      .map(
        (row) => `
          <div class="manual-entry-row" data-id="${row.id}" data-kind="${row.kind}">
            <span class="manual-entry-date">${row.date}</span>
            <span class="manual-entry-description">${row.description}</span>
            <span class="manual-entry-amount ${row.kind}">${row.kind === "expense" ? "-" : "+"} ${formatCurrency(row.amount)}</span>
            <button type="button" class="link-button manual-entry-remove">Remover</button>
          </div>
        `
      )
      .join("");

    manualList.querySelectorAll<HTMLButtonElement>(".manual-entry-remove").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>(".manual-entry-row");
        if (!row?.dataset.id || !row.dataset.kind) return;

        if (row.dataset.kind === "income") {
          await removeIncome(row.dataset.id);
        } else {
          await removeTransaction(row.dataset.id);
        }

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
        categoryId: classifyTransaction(description),
        origin: "manual",
      };
      await saveTransactions([entry]);
    }

    manualForm.reset();
    await loadData();
  }

  periodSelect.addEventListener("change", renderPeriod);
  manualForm.addEventListener("submit", onManualSubmit);
  document.addEventListener(EXPENSES_UPDATED_EVENT, () => void loadData());

  void loadData();
}
