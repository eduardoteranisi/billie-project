import {
  UNCATEGORIZED_CATEGORY_ID,
  UNCATEGORIZED_INCOME_CATEGORY_ID,
  type Category,
  type CategoryGroup,
  type CategoryRule,
} from "@billie/parser";
import { confirmAction } from "../components/confirm_modal";
import {
  countIncomeByCategory,
  countTransactionsByCategory,
  createCategory,
  deleteCategory,
  listCategories,
  listCategoryRules,
  updateCategory,
  type CategoryType,
} from "../services/finance_store";
import { listenStoredDataUpdated, notifyStoredDataUpdated } from "../services/stored_data_events";
import { escapeHtmlSpecialCharacters, getRequiredElementById } from "../utils/dom_helpers";

export function initCategoryManagerModal(): void {
  const btnOpen = getRequiredElementById<HTMLButtonElement>("btn-categories");
  const modal = getRequiredElementById<HTMLDivElement>("modal-categories");
  const btnClose = getRequiredElementById<HTMLButtonElement>("modal-categories-close");
  const categoryTypeToggle = getRequiredElementById<HTMLDivElement>("category-type-toggle");
  const expensePanel = getRequiredElementById<HTMLDivElement>("category-manager-expense");
  const incomePanel = getRequiredElementById<HTMLDivElement>("category-manager-income");
  const categoryForm = getRequiredElementById<HTMLFormElement>("category-form");
  const categoryGroupField = getRequiredElementById<HTMLDivElement>("category-group-field");
  const categoryLabelInput = getRequiredElementById<HTMLInputElement>("category-label");
  const categoryGroupSelect = getRequiredElementById<HTMLSelectElement>("category-group");
  const categoryKeywordsInput = getRequiredElementById<HTMLInputElement>("category-keywords");

  let activeCategoryType: CategoryType = "expense";

  bindEvents();
  listenStoredDataUpdated(() => void loadData());
  void loadData();

  async function loadData(): Promise<void> {
    const [expenseCategories, incomeCategories, expenseRules, incomeRules] = await Promise.all([
      listCategories("expense"),
      listCategories("income"),
      listCategoryRules("expense"),
      listCategoryRules("income"),
    ]);
    renderCategoryPanel(expensePanel, "expense", expenseCategories, expenseRules);
    renderCategoryPanel(incomePanel, "income", incomeCategories, incomeRules);
  }

  function renderCategoryPanel(
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
          <div class="category-manager-row" data-id="${escapeHtmlSpecialCharacters(category.id)}" data-type="${type}">
            <input type="text" class="category-manager-label" value="${escapeHtmlSpecialCharacters(category.label)}" />
            ${groupSelectHtml}
            <input
              type="text"
              class="category-manager-keywords"
              value="${escapeHtmlSpecialCharacters(keywords)}"
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
        notifyStoredDataUpdated();
      });
    });

    container.querySelectorAll<HTMLSelectElement>(".category-manager-group").forEach((select) => {
      select.addEventListener("change", async () => {
        const id = select.closest<HTMLElement>(".category-manager-row")?.dataset.id;
        if (!id) return;

        await updateCategory(id, { group: select.value as CategoryGroup });
        notifyStoredDataUpdated();
      });
    });

    container.querySelectorAll<HTMLInputElement>(".category-manager-keywords").forEach((input) => {
      input.addEventListener("change", async () => {
        const id = input.closest<HTMLElement>(".category-manager-row")?.dataset.id;
        if (!id) return;

        await updateCategory(id, { keywords: parseKeywordList(input.value) });
        notifyStoredDataUpdated();
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

        if (!(await confirmAction(confirmMessage))) return;

        await deleteCategory(id);
        notifyStoredDataUpdated();
      });
    });
  }

  function setActiveCategoryType(type: CategoryType): void {
    activeCategoryType = type;

    categoryTypeToggle.querySelectorAll<HTMLButtonElement>(".category-type-toggle-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.type === type);
    });

    expensePanel.hidden = type !== "expense";
    incomePanel.hidden = type !== "income";
    categoryGroupField.hidden = type !== "expense";
    categoryKeywordsInput.placeholder = type === "expense" ? "ex.: UBER, 99APP" : "ex.: SALARIO, FREELANCE";
  }

  async function onCategorySubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const label = categoryLabelInput.value.trim();
    if (!label) return;

    await createCategory({
      label,
      type: activeCategoryType,
      group: activeCategoryType === "expense" ? (categoryGroupSelect.value as CategoryGroup) : undefined,
      keywords: parseKeywordList(categoryKeywordsInput.value),
    });

    categoryForm.reset();
    notifyStoredDataUpdated();
  }

  function bindEvents(): void {
    btnOpen.addEventListener("click", () => { modal.hidden = false; });
    btnClose.addEventListener("click", () => { modal.hidden = true; });
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.hidden = true;
    });
    categoryTypeToggle.querySelectorAll<HTMLButtonElement>(".category-type-toggle-btn").forEach((button) => {
      button.addEventListener("click", () => setActiveCategoryType(button.dataset.type as CategoryType));
    });
    categoryForm.addEventListener("submit", onCategorySubmit);
  }
}

function parseKeywordList(text: string): string[] {
  return text
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}
