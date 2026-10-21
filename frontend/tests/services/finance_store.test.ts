import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  UNCATEGORIZED_CATEGORY_ID,
  UNCATEGORIZED_INCOME_CATEGORY_ID,
} from "@billie/parser";
import {
  BackupValidationError,
  countIncomeByCategory,
  countExpensesByCategory,
  createCategory,
  deleteCategory,
  exportBackupData,
  listCategories,
  listCategoryRules,
  listIncome,
  listExpenses,
  markIncomeIdListAsNotDuplicate,
  markExpenseIdListAsNotDuplicate,
  removeIncome,
  removeExpense,
  restoreBackupData,
  saveIncome,
  saveIncomeList,
  saveExpenseList,
  updateCategory,
  updateIncomeBank,
  updateIncomeCategory,
  updateIncomeFields,
  updateExpenseBank,
  updateExpenseCategory,
  updateExpenseFields,
} from "../../services/finance_store";
import { BACKUP_SCHEMA_VERSION } from "../../types";
import type { StoredExpense, StoredIncome } from "../../types";

const DATABASE_NAME = "billie-expenses";

function buildExpense(id: string, overrides: Partial<StoredExpense> = {}): StoredExpense {
  return {
    id,
    date: "2026-03-01",
    description: `Loja ${id}`,
    amount: 10,
    categoryId: "food",
    origin: "pdf",
    ...overrides,
  };
}

function buildIncome(id: string, overrides: Partial<StoredIncome> = {}): StoredIncome {
  return {
    id,
    date: "2026-03-05",
    description: `Receita ${id}`,
    amount: 100,
    categoryId: "salary",
    ...overrides,
  };
}

// cada teste começa com um IndexedDB vazio: finance_store.ts lê o `indexedDB` global a cada operação
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
});

describe("saveExpenseList", () => {
  it("salva despesas novas e conta quantas foram adicionadas", async () => {
    const result = await saveExpenseList([buildExpense("a"), buildExpense("b")]);

    expect(result).toEqual({ added: 2, duplicates: 0 });
    expect(await listExpenses()).toEqual([buildExpense("a"), buildExpense("b")]);
  });

  it("conta como duplicada a despesa que já estava salva", async () => {
    await saveExpenseList([buildExpense("a")]);

    const result = await saveExpenseList([buildExpense("a"), buildExpense("b")]);

    expect(result).toEqual({ added: 1, duplicates: 1 });
    expect(await listExpenses()).toHaveLength(2);
  });

  it("atualiza a despesa reimportada quando ela não foi editada à mão", async () => {
    await saveExpenseList([buildExpense("a", { categoryId: "food", bank: "Nubank" })]);

    await saveExpenseList([buildExpense("a", { categoryId: "shopping", bank: "Santander" })]);

    expect(await listExpenses()).toEqual([buildExpense("a", { categoryId: "shopping", bank: "Santander" })]);
  });

  it("preserva a categoria escolhida à mão ao reimportar", async () => {
    await saveExpenseList([buildExpense("a", { categoryId: "food" })]);
    await updateExpenseCategory("a", "leisure");

    await saveExpenseList([buildExpense("a", { categoryId: "food" })]);

    expect(await listExpenses()).toEqual([
      buildExpense("a", { categoryId: "leisure", categoryOverridden: true }),
    ]);
  });

  it("preserva data, descrição e valor editados à mão ao reimportar", async () => {
    await saveExpenseList([buildExpense("a")]);
    await updateExpenseFields("a", { date: "2026-03-09", description: "Padaria da esquina", amount: 12.5 });

    await saveExpenseList([buildExpense("a", { categoryId: "shopping" })]);

    const [stored] = await listExpenses();
    expect(stored).toMatchObject({
      date: "2026-03-09",
      description: "Padaria da esquina",
      amount: 12.5,
      detailsOverridden: true,
      // quem editou os detalhes também mantém a categoria que estava salva
      categoryId: "food",
    });
  });

  it("preserva o banco escolhido à mão ao reimportar", async () => {
    await saveExpenseList([buildExpense("a", { bank: "Nubank" })]);
    await updateExpenseBank("a", "Santander");

    await saveExpenseList([buildExpense("a", { bank: "Nubank" })]);

    expect(await listExpenses()).toEqual([buildExpense("a", { bank: "Santander", bankOverridden: true })]);
  });

  it("preserva o 'não é duplicado' ao reimportar", async () => {
    await saveExpenseList([buildExpense("a")]);
    await markExpenseIdListAsNotDuplicate(["a"]);

    await saveExpenseList([buildExpense("a")]);

    expect(await listExpenses()).toEqual([buildExpense("a", { duplicateDismissed: true })]);
  });
});

describe("updateExpenseFields", () => {
  it("marca a despesa como editada à mão", async () => {
    await saveExpenseList([buildExpense("a")]);

    await updateExpenseFields("a", { date: "2026-03-01", description: "Novo nome", amount: 10 });

    expect(await listExpenses()).toEqual([
      buildExpense("a", { description: "Novo nome", detailsOverridden: true, duplicateDismissed: undefined }),
    ]);
  });

  it("mantém o 'não é duplicado' quando só a descrição muda", async () => {
    await saveExpenseList([buildExpense("a", { duplicateDismissed: true })]);

    await updateExpenseFields("a", { date: "2026-03-01", description: "Novo nome", amount: 10 });

    expect((await listExpenses())[0].duplicateDismissed).toBe(true);
  });

  it("desfaz o 'não é duplicado' quando a data muda", async () => {
    await saveExpenseList([buildExpense("a", { duplicateDismissed: true })]);

    await updateExpenseFields("a", { date: "2026-03-02", description: "Loja a", amount: 10 });

    expect((await listExpenses())[0].duplicateDismissed).toBe(false);
  });

  it("desfaz o 'não é duplicado' quando o valor muda", async () => {
    await saveExpenseList([buildExpense("a", { duplicateDismissed: true })]);

    await updateExpenseFields("a", { date: "2026-03-01", description: "Loja a", amount: 11 });

    expect((await listExpenses())[0].duplicateDismissed).toBe(false);
  });

  it("falha quando a despesa não existe", async () => {
    await expect(
      updateExpenseFields("nao-existe", { date: "2026-03-01", description: "x", amount: 1 })
    ).rejects.toThrow("transação #nao-existe não encontrada");
  });
});

describe("updateExpenseCategory", () => {
  it("troca a categoria e marca como escolhida à mão", async () => {
    await saveExpenseList([buildExpense("a", { categoryId: "food" })]);

    await updateExpenseCategory("a", "leisure");

    expect(await listExpenses()).toEqual([
      buildExpense("a", { categoryId: "leisure", categoryOverridden: true }),
    ]);
  });
});

describe("updateExpenseBank", () => {
  it("permite remover o banco de uma despesa", async () => {
    await saveExpenseList([buildExpense("a", { bank: "Nubank" })]);

    await updateExpenseBank("a", undefined);

    const [stored] = await listExpenses();
    expect(stored.bank).toBeUndefined();
    expect(stored.bankOverridden).toBe(true);
  });
});

describe("removeExpense", () => {
  it("remove só a despesa indicada", async () => {
    await saveExpenseList([buildExpense("a"), buildExpense("b")]);

    await removeExpense("a");

    expect(await listExpenses()).toEqual([buildExpense("b")]);
  });
});

describe("markExpenseIdListAsNotDuplicate", () => {
  it("marca as despesas indicadas e ignora ids que não existem", async () => {
    await saveExpenseList([buildExpense("a"), buildExpense("b"), buildExpense("c")]);

    await markExpenseIdListAsNotDuplicate(["a", "nao-existe", "c"]);

    expect(await listExpenses()).toEqual([
      buildExpense("a", { duplicateDismissed: true }),
      buildExpense("b"),
      buildExpense("c", { duplicateDismissed: true }),
    ]);
  });
});

describe("saveIncome", () => {
  it("salva uma receita e substitui a que tem o mesmo id", async () => {
    await saveIncome(buildIncome("a", { amount: 100 }));
    await saveIncome(buildIncome("a", { amount: 150 }));

    expect(await listIncome()).toEqual([buildIncome("a", { amount: 150 })]);
  });
});

describe("saveIncomeList", () => {
  it("salva receitas novas e conta as duplicadas", async () => {
    await saveIncomeList([buildIncome("a")]);

    const result = await saveIncomeList([buildIncome("a"), buildIncome("b")]);

    expect(result).toEqual({ added: 1, duplicates: 1 });
    expect(await listIncome()).toEqual([buildIncome("a"), buildIncome("b")]);
  });

  it("preserva categoria, detalhes, banco e 'não é duplicado' editados à mão ao reimportar", async () => {
    await saveIncomeList([buildIncome("a", { bank: "Nubank" })]);
    await updateIncomeCategory("a", "freelance");
    await updateIncomeFields("a", { date: "2026-03-07", description: "Projeto do cliente", amount: 250 });
    await updateIncomeBank("a", "Santander");
    await markIncomeIdListAsNotDuplicate(["a"]);

    await saveIncomeList([buildIncome("a", { bank: "Nubank" })]);

    expect(await listIncome()).toEqual([
      {
        id: "a",
        date: "2026-03-07",
        description: "Projeto do cliente",
        amount: 250,
        categoryId: "freelance",
        categoryOverridden: true,
        detailsOverridden: true,
        bank: "Santander",
        bankOverridden: true,
        duplicateDismissed: true,
      },
    ]);
  });
});

describe("updateIncomeFields", () => {
  it("desfaz o 'não é duplicado' quando o valor muda", async () => {
    await saveIncome(buildIncome("a", { duplicateDismissed: true }));

    await updateIncomeFields("a", { date: "2026-03-05", description: "Receita a", amount: 101 });

    expect((await listIncome())[0].duplicateDismissed).toBe(false);
  });

  it("falha quando a receita não existe", async () => {
    await expect(
      updateIncomeFields("nao-existe", { date: "2026-03-05", description: "x", amount: 1 })
    ).rejects.toThrow("receita #nao-existe não encontrada");
  });
});

describe("removeIncome", () => {
  it("remove só a receita indicada", async () => {
    await saveIncomeList([buildIncome("a"), buildIncome("b")]);

    await removeIncome("a");

    expect(await listIncome()).toEqual([buildIncome("b")]);
  });
});

describe("listCategories", () => {
  it("cria as categorias padrão no primeiro uso, separadas por tipo", async () => {
    expect(await listCategories("expense")).toEqual(expect.arrayContaining(DEFAULT_CATEGORIES));
    expect(await listCategories("expense")).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(await listCategories("income")).toEqual(expect.arrayContaining(DEFAULT_INCOME_CATEGORIES));
    expect(await listCategories("income")).toHaveLength(DEFAULT_INCOME_CATEGORIES.length);
  });

  it("não recria uma categoria padrão que foi excluída", async () => {
    await listCategories("expense");
    await deleteCategory("leisure");

    const categoryIds = (await listCategories("expense")).map((category) => category.id);

    expect(categoryIds).not.toContain("leisure");
  });
});

describe("listCategoryRules", () => {
  it("devolve só as regras das categorias do tipo pedido", async () => {
    const expenseRuleIds = (await listCategoryRules("expense")).map((rule) => rule.categoryId);
    const incomeRuleIds = (await listCategoryRules("income")).map((rule) => rule.categoryId);

    expect(expenseRuleIds).toContain("food");
    expect(expenseRuleIds).not.toContain("salary");
    expect(incomeRuleIds).toContain("salary");
    expect(incomeRuleIds).not.toContain("food");
  });
});

describe("createCategory", () => {
  it("cria uma categoria de despesa com grupo e palavras-chave", async () => {
    const category = await createCategory({ label: "Pets", type: "expense", group: "fixed", keywords: ["PETZ"] });

    expect(category).toMatchObject({ label: "Pets", type: "expense", group: "fixed" });
    expect(await listCategories("expense")).toContainEqual(category);
    expect(await listCategoryRules("expense")).toContainEqual({ categoryId: category.id, keywords: ["PETZ"] });
  });

  it("usa o grupo variável quando a despesa não informa grupo", async () => {
    const category = await createCategory({ label: "Pets", type: "expense", keywords: [] });

    expect(category).toMatchObject({ type: "expense", group: "variable" });
  });

  it("cria uma categoria de receita sem grupo", async () => {
    const category = await createCategory({ label: "Aluguel recebido", type: "income", keywords: ["ALUGUEL"] });

    expect(category).toEqual({ id: category.id, label: "Aluguel recebido", type: "income" });
    expect(await listCategories("income")).toContainEqual(category);
  });
});

describe("updateCategory", () => {
  it("troca o nome e o grupo sem mexer nas palavras-chave", async () => {
    const category = await createCategory({ label: "Pets", type: "expense", group: "fixed", keywords: ["PETZ"] });

    await updateCategory(category.id, { label: "Animais", group: "variable" });

    expect(await listCategories("expense")).toContainEqual({
      id: category.id,
      label: "Animais",
      type: "expense",
      group: "variable",
    });
    expect(await listCategoryRules("expense")).toContainEqual({ categoryId: category.id, keywords: ["PETZ"] });
  });

  it("troca só as palavras-chave", async () => {
    const category = await createCategory({ label: "Pets", type: "expense", keywords: ["PETZ"] });

    await updateCategory(category.id, { keywords: ["PETZ", "COBASI"] });

    expect(await listCategoryRules("expense")).toContainEqual({
      categoryId: category.id,
      keywords: ["PETZ", "COBASI"],
    });
    expect(await listCategories("expense")).toContainEqual(category);
  });

  it("falha quando a categoria não existe", async () => {
    await expect(updateCategory("nao-existe", { label: "x" })).rejects.toThrow(
      "categoria #nao-existe não encontrada"
    );
  });
});

describe("countExpensesByCategory", () => {
  it("conta as despesas da categoria", async () => {
    await saveExpenseList([
      buildExpense("a", { categoryId: "food" }),
      buildExpense("b", { categoryId: "food" }),
      buildExpense("c", { categoryId: "leisure" }),
    ]);

    expect(await countExpensesByCategory("food")).toBe(2);
    expect(await countExpensesByCategory("housing")).toBe(0);
  });
});

describe("countIncomeByCategory", () => {
  it("conta as receitas da categoria", async () => {
    await saveIncomeList([
      buildIncome("a", { categoryId: "salary" }),
      buildIncome("b", { categoryId: "freelance" }),
    ]);

    expect(await countIncomeByCategory("salary")).toBe(1);
    expect(await countIncomeByCategory("investments")).toBe(0);
  });
});

describe("deleteCategory", () => {
  it("move as despesas da categoria excluída para 'Outros' e remove a categoria e a regra", async () => {
    await listCategories("expense");
    await saveExpenseList([
      buildExpense("a", { categoryId: "leisure" }),
      buildExpense("b", { categoryId: "food" }),
    ]);

    await deleteCategory("leisure");

    expect(await listExpenses()).toEqual([
      buildExpense("a", { categoryId: UNCATEGORIZED_CATEGORY_ID }),
      buildExpense("b", { categoryId: "food" }),
    ]);
    expect((await listCategories("expense")).map((category) => category.id)).not.toContain("leisure");
    expect((await listCategoryRules("expense")).map((rule) => rule.categoryId)).not.toContain("leisure");
  });

  it("move as receitas da categoria excluída para 'Outros' de receita", async () => {
    await listCategories("income");
    await saveIncomeList([buildIncome("a", { categoryId: "freelance" })]);

    await deleteCategory("freelance");

    expect(await listIncome()).toEqual([buildIncome("a", { categoryId: UNCATEGORIZED_INCOME_CATEGORY_ID })]);
  });

  it("não deixa excluir as categorias 'Outros'", async () => {
    await listCategories("expense");

    await expect(deleteCategory(UNCATEGORIZED_CATEGORY_ID)).rejects.toThrow("não pode ser excluída");
    await expect(deleteCategory(UNCATEGORIZED_INCOME_CATEGORY_ID)).rejects.toThrow("não pode ser excluída");
  });

  it("falha quando a categoria não existe", async () => {
    await expect(deleteCategory("nao-existe")).rejects.toThrow("categoria #nao-existe não encontrada");
  });
});

describe("exportBackupData", () => {
  it("exporta despesas, receitas, categorias e regras com a versão do formato", async () => {
    await saveExpenseList([buildExpense("a")]);
    await saveIncomeList([buildIncome("b")]);

    const backup = await exportBackupData();

    expect(backup.schemaVersion).toBe(2);
    expect(backup.expenses).toEqual([buildExpense("a")]);
    expect(backup.income).toEqual([buildIncome("b")]);
    expect(backup.categories).toHaveLength(DEFAULT_CATEGORIES.length + DEFAULT_INCOME_CATEGORIES.length);
    expect(backup.categoryRules.map((rule) => rule.categoryId)).toEqual(
      expect.arrayContaining(["food", "salary"])
    );
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
  });
});

describe("restoreBackupData", () => {
  it("restaura num banco vazio tudo o que foi exportado", async () => {
    await saveExpenseList([buildExpense("a", { categoryOverridden: true })]);
    await saveIncomeList([buildIncome("b")]);
    const custom = await createCategory({ label: "Pets", type: "expense", keywords: ["PETZ"] });
    const backup = JSON.parse(JSON.stringify(await exportBackupData()));

    vi.stubGlobal("indexedDB", new IDBFactory());
    await restoreBackupData(backup);

    expect(await listExpenses()).toEqual([buildExpense("a", { categoryOverridden: true })]);
    expect(await listIncome()).toEqual([buildIncome("b")]);
    expect(await listCategories("expense")).toContainEqual(custom);
    expect(await listCategoryRules("expense")).toContainEqual({ categoryId: custom.id, keywords: ["PETZ"] });
  });

  it("restaura um backup da versão 1, em que as despesas vinham em `transactions` com `merchant`", async () => {
    const legacyBackup = {
      schemaVersion: 1,
      exportedAt: "2026-09-01T12:00:00.000Z",
      transactions: [
        {
          id: "a",
          date: "2026-03-01",
          merchant: "Padaria",
          amount: 10,
          categoryId: "food",
          origin: "pdf",
          bank: "Nubank",
          categoryOverridden: true,
        },
      ],
      income: [buildIncome("b")],
      categories: [{ id: "pets", label: "Pets", type: "expense", group: "variable" }],
      categoryRules: [{ categoryId: "pets", keywords: ["PETZ"] }],
    };

    await restoreBackupData(legacyBackup);

    expect(await listExpenses()).toEqual([
      {
        id: "a",
        date: "2026-03-01",
        description: "Padaria",
        amount: 10,
        categoryId: "food",
        origin: "pdf",
        bank: "Nubank",
        categoryOverridden: true,
      },
    ]);
    expect(await listIncome()).toEqual([buildIncome("b")]);
    expect(await listCategories("expense")).toContainEqual({
      id: "pets",
      label: "Pets",
      type: "expense",
      group: "variable",
    });
    expect(await listCategoryRules("expense")).toContainEqual({ categoryId: "pets", keywords: ["PETZ"] });
  });

  it("mantém os lançamentos que já existiam e não estão no backup", async () => {
    await saveExpenseList([buildExpense("a")]);
    const backup = await exportBackupData();
    await saveExpenseList([buildExpense("novo")]);

    await restoreBackupData(backup);

    expect((await listExpenses()).map((expense) => expense.id).sort()).toEqual(["a", "novo"]);
  });

  it("recusa um arquivo que não é um backup", async () => {
    await expect(restoreBackupData(null)).rejects.toThrow(BackupValidationError);
    await expect(restoreBackupData("texto")).rejects.toThrow("arquivo de backup inválido");
    await expect(
      restoreBackupData({ schemaVersion: BACKUP_SCHEMA_VERSION, expenses: [], income: [], categories: [] })
    ).rejects.toThrow("arquivo de backup inválido");
  });

  it("recusa um backup cuja lista de despesas está na chave de outra versão", async () => {
    const lists = { income: [], categories: [], categoryRules: [] };

    await expect(restoreBackupData({ schemaVersion: 2, transactions: [], ...lists })).rejects.toThrow(
      "arquivo de backup inválido"
    );
    await expect(restoreBackupData({ schemaVersion: 1, expenses: [], ...lists })).rejects.toThrow(
      "arquivo de backup inválido"
    );
  });

  it("recusa um backup de versão desconhecida sem gravar nada", async () => {
    const backup = { ...(await exportBackupData()), schemaVersion: 99, expenses: [buildExpense("a")] };

    await expect(restoreBackupData(backup)).rejects.toThrow("versão do arquivo de backup não suportada");
    expect(await listExpenses()).toEqual([]);
  });

  it("recusa um backup com um item inválido sem gravar nenhum dos válidos", async () => {
    const backup = {
      ...(await exportBackupData()),
      expenses: [buildExpense("a"), { ...buildExpense("b"), amount: "<img src=x onerror=alert(1)>" }],
      income: [buildIncome("c")],
    };

    await expect(restoreBackupData(backup)).rejects.toThrow("despesa nº 2 está corrompida ou incompleta");
    expect(await listExpenses()).toEqual([]);
    expect(await listIncome()).toEqual([]);
  });
});

describe("migração do banco", () => {
  const LEGACY_EXPENSE = {
    id: "a",
    date: "2026-03-01",
    merchant: "Padaria",
    amount: 10,
    categoryId: "food",
    origin: "pdf",
    bank: "Nubank",
    categoryOverridden: true,
    detailsOverridden: true,
    duplicateDismissed: true,
  };
  const MIGRATED_EXPENSE = {
    id: "a",
    date: "2026-03-01",
    description: "Padaria",
    amount: 10,
    categoryId: "food",
    origin: "pdf",
    bank: "Nubank",
    categoryOverridden: true,
    detailsOverridden: true,
    duplicateDismissed: true,
  };

  // monta o banco como uma versão antiga do app o deixou, com as stores e as linhas daquela versão
  function createLegacyDatabase(version: number, rowsByStore: Record<string, object[]>): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, version);

      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore("transactions", { keyPath: "id" });
        database.createObjectStore("income", { keyPath: "id" });
        database.createObjectStore("categories", { keyPath: "id" });
        database.createObjectStore("categoryRules", { keyPath: "categoryId" });

        for (const [storeName, rows] of Object.entries(rowsByStore)) {
          for (const row of rows) request.transaction!.objectStore(storeName).put(row);
        }
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  function listDatabaseStoreNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME);
      request.onsuccess = () => {
        const storeNames = [...request.result.objectStoreNames];
        request.result.close();
        resolve(storeNames);
      };
      request.onerror = () => reject(request.error);
    });
  }

  it("da versão 3: move as despesas de `transactions` para `expenses`, trocando `merchant` por `description`", async () => {
    const secondLegacyExpense = { id: "b", date: "2026-03-02", merchant: "Mercado", amount: 55.9, categoryId: "food", origin: "csv" };
    await createLegacyDatabase(3, {
      transactions: [LEGACY_EXPENSE, secondLegacyExpense],
      income: [buildIncome("r", { categoryOverridden: true })],
      categories: [
        { id: "food", label: "Alimentação", type: "expense", group: "variable" },
        { id: "pets", label: "Pets", type: "expense", group: "fixed" },
        { id: "salary", label: "Salário", type: "income" },
      ],
      categoryRules: [{ categoryId: "pets", keywords: ["PETZ"] }],
    });

    expect(await listExpenses()).toEqual([
      MIGRATED_EXPENSE,
      { id: "b", date: "2026-03-02", description: "Mercado", amount: 55.9, categoryId: "food", origin: "csv" },
    ]);
    expect(await listIncome()).toEqual([buildIncome("r", { categoryOverridden: true })]);
    expect(await listCategories("expense")).toEqual([
      { id: "food", label: "Alimentação", type: "expense", group: "variable" },
      { id: "pets", label: "Pets", type: "expense", group: "fixed" },
    ]);
    expect(await listCategoryRules("expense")).toEqual([{ categoryId: "pets", keywords: ["PETZ"] }]);
    expect((await listDatabaseStoreNames()).sort()).toEqual(["categories", "categoryRules", "expenses", "income"]);
  });

  it("da versão 3: os lançamentos migrados continuam sendo reconhecidos ao reimportar", async () => {
    await createLegacyDatabase(3, { transactions: [LEGACY_EXPENSE] });

    const result = await saveExpenseList([
      buildExpense("a", { date: "2026-03-01", description: "PADARIA ORIGINAL", amount: 9, categoryId: "shopping" }),
    ]);

    expect(result).toEqual({ added: 0, duplicates: 1 });
    expect(await listExpenses()).toEqual([{ ...MIGRATED_EXPENSE, bank: undefined }]);
  });

  it("da versão 3 sem despesas: cria a store `expenses` vazia", async () => {
    await createLegacyDatabase(3, {});

    expect(await listExpenses()).toEqual([]);
    expect(await listDatabaseStoreNames()).not.toContain("transactions");
  });

  it("da versão 2: além das despesas, dá tipo às categorias antigas e categoria às receitas antigas", async () => {
    await createLegacyDatabase(2, {
      transactions: [LEGACY_EXPENSE],
      income: [{ id: "b", date: "2026-03-05", description: "Salário", amount: 100 }],
      categories: [{ id: "food", label: "Alimentação", group: "variable" }],
    });

    expect(await listExpenses()).toEqual([MIGRATED_EXPENSE]);
    expect(await listIncome()).toEqual([
      { id: "b", date: "2026-03-05", description: "Salário", amount: 100, categoryId: UNCATEGORIZED_INCOME_CATEGORY_ID },
    ]);
    expect(await listCategories("expense")).toEqual([
      { id: "food", label: "Alimentação", group: "variable", type: "expense" },
    ]);
  });

  it("num banco novo: cria só as stores atuais", async () => {
    await listExpenses();

    expect((await listDatabaseStoreNames()).sort()).toEqual(["categories", "categoryRules", "expenses", "income"]);
  });
});
