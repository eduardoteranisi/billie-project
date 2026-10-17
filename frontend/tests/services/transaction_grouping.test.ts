import { describe, expect, it } from "vitest";
import type { Bank, Category } from "@billie/parser";
import {
  groupTransactionsByBank,
  groupTransactionsByCategory,
  groupTransactionsByDay,
  UNKNOWN_BANK_LABEL,
  UNKNOWN_CATEGORY_LABEL,
} from "../../services/transaction_grouping";

interface Row {
  id: string;
  date: string;
  amount: number;
  bank?: Bank;
}

const rows: Row[] = [
  { id: "1", date: "2026-03-02", amount: 10, bank: "Nubank" },
  { id: "2", date: "2026-03-01", amount: 5 },
  { id: "3", date: "2026-03-02", amount: 100, bank: "Santander" },
  { id: "4", date: "2026-03-01", amount: 20, bank: "Nubank" },
];

describe("groupTransactionsByBank", () => {
  it("agrupa por banco, do maior total ao menor, com 'não identificado' por último", () => {
    const groups = groupTransactionsByBank(rows);

    expect(groups.map((g) => [g.label, g.total, g.transactions.map((t) => t.id)])).toEqual([
      ["Santander", 100, ["3"]],
      ["Nubank", 30, ["1", "4"]],
      [UNKNOWN_BANK_LABEL, 5, ["2"]],
    ]);
  });

  it("não cria o grupo 'não identificado' se todas têm banco", () => {
    const groups = groupTransactionsByBank(rows.filter((row) => row.bank));

    expect(groups.map((g) => g.key)).toEqual(["Santander", "Nubank"]);
  });

  it("devolve lista vazia sem transações", () => {
    expect(groupTransactionsByBank([])).toEqual([]);
  });
});

describe("groupTransactionsByCategory", () => {
  const categories: Category[] = [
    { id: "food", label: "Alimentação", type: "expense", group: "variable" },
    { id: "housing", label: "Moradia", type: "expense", group: "fixed" },
    { id: "other", label: "Outros / Não categorizado", type: "expense", group: "variable" },
  ];

  const categorizedRows = [
    { id: "1", amount: 10, categoryId: "food" },
    { id: "2", amount: 500, categoryId: "other" },
    { id: "3", amount: 100, categoryId: "housing" },
    { id: "4", amount: 20, categoryId: "food" },
  ];

  it("agrupa por categoria, do maior total ao menor, com 'não categorizado' por último", () => {
    const groups = groupTransactionsByCategory(categorizedRows, categories);

    expect(groups.map((g) => [g.label, g.total, g.transactions.map((t) => t.id)])).toEqual([
      ["Moradia", 100, ["3"]],
      ["Alimentação", 30, ["1", "4"]],
      ["Outros / Não categorizado", 500, ["2"]],
    ]);
  });

  it("trata a categoria de receita não categorizada como não categorizada", () => {
    const incomeCategories: Category[] = [
      { id: "salary", label: "Salário", type: "income" },
      { id: "other-income", label: "Outros / Não categorizado", type: "income" },
    ];
    const incomeRows = [
      { id: "1", amount: 900, categoryId: "other-income" },
      { id: "2", amount: 100, categoryId: "salary" },
    ];

    expect(groupTransactionsByCategory(incomeRows, incomeCategories).map((g) => g.key)).toEqual([
      "salary",
      "other-income",
    ]);
  });

  it("junta uma categoria que não existe mais ao grupo 'não categorizado'", () => {
    const groups = groupTransactionsByCategory([...categorizedRows, { id: "5", amount: 999, categoryId: "deleted" }], categories);

    expect(groups.map((g) => g.key)).toEqual(["housing", "food", "other"]);
    expect(groups.at(-1)).toMatchObject({ total: 1499 });
    expect(groups.at(-1)?.transactions.map((t) => t.id)).toEqual(["2", "5"]);
  });

  it("usa o rótulo padrão quando a lista de categorias não tem a 'não categorizado'", () => {
    const groups = groupTransactionsByCategory([{ id: "1", amount: 10, categoryId: "deleted" }], []);

    expect(groups).toMatchObject([{ key: "other", label: UNKNOWN_CATEGORY_LABEL, total: 10 }]);
  });

  it("devolve lista vazia sem transações", () => {
    expect(groupTransactionsByCategory([], categories)).toEqual([]);
  });
});

describe("groupTransactionsByDay", () => {
  it("agrupa por dia, em ordem cronológica, somando os valores", () => {
    const groups = groupTransactionsByDay(rows);

    expect(groups.map((g) => [g.key, g.total, g.transactions.map((t) => t.id)])).toEqual([
      ["2026-03-01", 25, ["2", "4"]],
      ["2026-03-02", 110, ["1", "3"]],
    ]);
  });
});
