import type { Category } from "@billie/parser";
import { calculateDre, listAvailablePeriods } from "../services/dre_aggregator";
import { listCategories, listIncome, listExpenses } from "../services/finance_store";
import {
  getSelectedPeriod,
  listenSelectedPeriodChanged,
  setSelectedPeriod,
  syncSelectedPeriodWithAvailableList,
} from "../services/selected_period";
import { listenStoredDataUpdated } from "../services/stored_data_events";
import type { CategorySummary, DreSummary, StoredExpense, StoredIncome } from "../types";
import { formatBrlCurrency } from "../utils/currency_format";
import { escapeHtmlSpecialCharacters, getRequiredElementById } from "../utils/dom_helpers";

const EMPTY_DRE_SUMMARY: DreSummary = {
  period: "",
  totalIncome: 0,
  fixedExpenses: 0,
  variableExpenses: 0,
  result: 0,
  expenseCategories: [],
  incomeCategories: [],
};

export function initOverviewView(): void {
  const periodSelect = getRequiredElementById<HTMLSelectElement>("overview-period");
  const incomeCard = getRequiredElementById<HTMLParagraphElement>("dre-income");
  const fixedCard = getRequiredElementById<HTMLParagraphElement>("dre-fixed");
  const variableCard = getRequiredElementById<HTMLParagraphElement>("dre-variable");
  const resultCard = getRequiredElementById<HTMLParagraphElement>("dre-result");
  const expenseCategoryList = getRequiredElementById<HTMLDivElement>("category-list");
  const incomeCategoryList = getRequiredElementById<HTMLDivElement>("income-category-list");
  const emptyHint = getRequiredElementById<HTMLElement>("overview-empty-hint");

  let expenses: StoredExpense[] = [];
  let income: StoredIncome[] = [];
  let categories: Category[] = [];

  periodSelect.addEventListener("change", () => setSelectedPeriod(periodSelect.value));
  listenSelectedPeriodChanged(renderSelectedPeriod);
  listenStoredDataUpdated(() => void loadData());
  void loadData();

  async function loadData(): Promise<void> {
    let expenseCategories: Category[];
    let incomeCategories: Category[];
    [expenses, income, expenseCategories, incomeCategories] = await Promise.all([
      listExpenses(),
      listIncome(),
      listCategories("expense"),
      listCategories("income"),
    ]);
    categories = [...expenseCategories, ...incomeCategories];

    const periods = listAvailablePeriods(expenses, income);
    emptyHint.hidden = periods.length > 0;
    periodSelect.innerHTML = periods
      .map((period) => `<option value="${escapeHtmlSpecialCharacters(period)}">${escapeHtmlSpecialCharacters(period)}</option>`)
      .join("");
    syncSelectedPeriodWithAvailableList(periods);
    renderSelectedPeriod();
  }

  function renderSelectedPeriod(): void {
    const period = getSelectedPeriod();
    periodSelect.value = period;

    const summary = period ? calculateDre(period, expenses, income, categories) : EMPTY_DRE_SUMMARY;

    setCardValue(incomeCard, summary.totalIncome);
    setCardValue(fixedCard, summary.fixedExpenses);
    setCardValue(variableCard, summary.variableExpenses);
    setCardValue(resultCard, summary.result);
    resultCard.classList.toggle("negative", summary.result < 0);

    renderCategoryBreakdown(
      expenseCategoryList,
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
}

function setCardValue(el: HTMLElement, value: number): void {
  const text = formatBrlCurrency(value);
  el.textContent = text;
  el.style.setProperty("--value-length", String(text.length));
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
      const fillGroupClass = category.group ? ` category-bar-fill-${escapeHtmlSpecialCharacters(category.group)}` : "";
      return `
        <div class="category-row">
          <div class="category-row-header">
            <span>${escapeHtmlSpecialCharacters(category.label)}</span>
            <span>${formatBrlCurrency(category.total)}</span>
          </div>
          <div class="category-bar"><div class="category-bar-fill${fillGroupClass}" style="width: ${barWidth}%"></div></div>
        </div>
      `;
    })
    .join("");
}
