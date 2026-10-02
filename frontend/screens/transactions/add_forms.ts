import {
  classifyTransactionDescription,
  UNCATEGORIZED_CATEGORY_ID,
  UNCATEGORIZED_INCOME_CATEGORY_ID,
  type Category,
  type CategoryRule,
} from "@billie/parser";
import { listCategories, listCategoryRules, saveIncome, saveTransactions } from "../../services/finance_store";
import { listenStoredDataUpdated, notifyStoredDataUpdated } from "../../services/stored_data_events";
import type { ManualIncomeEntry, StoredTransaction } from "../../types";
import { getRequiredElementById } from "../../utils/dom_helpers";
import { buildCategoryOptionsHtml } from "./category_options_html";

export function initTransactionAddForms(): void {
  const btnAddIncome = getRequiredElementById<HTMLButtonElement>("btn-add-income");
  const incomeAddPopover = getRequiredElementById<HTMLDivElement>("income-add-popover");
  const incomeAddForm = getRequiredElementById<HTMLFormElement>("income-add-form");
  const incomeAddDate = getRequiredElementById<HTMLInputElement>("income-add-date");
  const incomeAddDescription = getRequiredElementById<HTMLInputElement>("income-add-description");
  const incomeAddCategory = getRequiredElementById<HTMLSelectElement>("income-add-category");
  const incomeAddAmount = getRequiredElementById<HTMLInputElement>("income-add-amount");
  const btnAddExpense = getRequiredElementById<HTMLButtonElement>("btn-add-expense");
  const expenseAddPopover = getRequiredElementById<HTMLDivElement>("expense-add-popover");
  const expenseAddForm = getRequiredElementById<HTMLFormElement>("expense-add-form");
  const expenseAddDate = getRequiredElementById<HTMLInputElement>("expense-add-date");
  const expenseAddDescription = getRequiredElementById<HTMLInputElement>("expense-add-description");
  const expenseAddCategory = getRequiredElementById<HTMLSelectElement>("expense-add-category");
  const expenseAddAmount = getRequiredElementById<HTMLInputElement>("expense-add-amount");

  let expenseCategoryRules: CategoryRule[] = [];
  let incomeCategoryRules: CategoryRule[] = [];
  // depois que o usuário escolhe a categoria, a descrição digitada não sugere outra por cima
  let incomeCategoryTouched = false;
  let expenseCategoryTouched = false;

  bindEvents();
  listenStoredDataUpdated(() => void loadCategories());
  void loadCategories();

  async function loadCategories(): Promise<void> {
    let expenseCategories: Category[];
    let incomeCategories: Category[];
    [expenseCategories, incomeCategories, expenseCategoryRules, incomeCategoryRules] = await Promise.all([
      listCategories("expense"),
      listCategories("income"),
      listCategoryRules("expense"),
      listCategoryRules("income"),
    ]);
    fillCategorySelect(incomeAddCategory, incomeCategories);
    fillCategorySelect(expenseAddCategory, expenseCategories);
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
    notifyStoredDataUpdated();
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
    notifyStoredDataUpdated();
  }

  function bindEvents(): void {
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
  }
}

function fillCategorySelect(select: HTMLSelectElement, categories: Category[]): void {
  const previousValue = select.value;
  select.innerHTML = buildCategoryOptionsHtml(categories, previousValue);
  if (!select.value && categories.length > 0) select.value = categories[0].id;
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
