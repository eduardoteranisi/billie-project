import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { UNCATEGORIZED_CATEGORY_ID, UNCATEGORIZED_INCOME_CATEGORY_ID, type Transaction } from "@billie/parser";
import {
  createCategory,
  listIncome,
  listExpenses,
  updateExpenseCategory,
} from "../../services/finance_store";
import {
  classifyAndSaveExpenseList,
  classifyAndSaveIncomeList,
  sumSaveResults,
} from "../../services/transaction_saver";

function buildTransaction(id: string, description: string): Transaction {
  return { id, date: "2026-03-01", description, amount: 10, bank: "Nubank" };
}

// cada teste começa com um IndexedDB vazio: finance_store.ts lê o `indexedDB` global a cada operação
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
});

describe("classifyAndSaveExpenseList", () => {
  it("classifica pelas regras padrão e salva com a origem informada", async () => {
    const result = await classifyAndSaveExpenseList(
      [buildTransaction("a", "IFOOD *RESTAURANTE"), buildTransaction("b", "LOJA DESCONHECIDA")],
      "csv"
    );

    expect(result).toEqual({ added: 2, duplicates: 0 });
    expect(await listExpenses()).toEqual([
      { ...buildTransaction("a", "IFOOD *RESTAURANTE"), categoryId: "food", origin: "csv" },
      { ...buildTransaction("b", "LOJA DESCONHECIDA"), categoryId: UNCATEGORIZED_CATEGORY_ID, origin: "csv" },
    ]);
  });

  it("usa as palavras-chave das categorias criadas pelo usuário", async () => {
    const pets = await createCategory({ label: "Pets", type: "expense", keywords: ["PETZ"] });

    await classifyAndSaveExpenseList([buildTransaction("a", "PETZ MOEMA")], "pdf");

    expect((await listExpenses())[0].categoryId).toBe(pets.id);
  });

  it("ao reimportar, conta como duplicada e mantém a categoria escolhida à mão", async () => {
    await classifyAndSaveExpenseList([buildTransaction("a", "IFOOD *RESTAURANTE")], "pdf");
    await updateExpenseCategory("a", "leisure");

    const result = await classifyAndSaveExpenseList([buildTransaction("a", "IFOOD *RESTAURANTE")], "pdf");

    expect(result).toEqual({ added: 0, duplicates: 1 });
    expect((await listExpenses())[0].categoryId).toBe("leisure");
  });
});

describe("classifyAndSaveIncomeList", () => {
  it("classifica pelas regras de receita e salva como receita", async () => {
    const result = await classifyAndSaveIncomeList([
      buildTransaction("a", "SALARIO EMPRESA X"),
      buildTransaction("b", "PIX RECEBIDO FULANO"),
    ]);

    expect(result).toEqual({ added: 2, duplicates: 0 });
    expect(await listIncome()).toEqual([
      {
        id: "a",
        date: "2026-03-01",
        description: "SALARIO EMPRESA X",
        amount: 10,
        categoryId: "salary",
        bank: "Nubank",
      },
      {
        id: "b",
        date: "2026-03-01",
        description: "PIX RECEBIDO FULANO",
        amount: 10,
        categoryId: UNCATEGORIZED_INCOME_CATEGORY_ID,
        bank: "Nubank",
      },
    ]);
    expect(await listExpenses()).toEqual([]);
  });

  it("não salva nada sem receitas", async () => {
    expect(await classifyAndSaveIncomeList(undefined)).toEqual({ added: 0, duplicates: 0 });
    expect(await classifyAndSaveIncomeList([])).toEqual({ added: 0, duplicates: 0 });
    expect(await listIncome()).toEqual([]);
  });
});

describe("sumSaveResults", () => {
  it("soma adicionados e duplicados de vários salvamentos", () => {
    expect(
      sumSaveResults({ added: 3, duplicates: 1 }, { added: 2, duplicates: 0 }, { added: 0, duplicates: 4 })
    ).toEqual({ added: 5, duplicates: 5 });
  });

  it("devolve zero sem nenhum salvamento", () => {
    expect(sumSaveResults()).toEqual({ added: 0, duplicates: 0 });
  });
});
