import { describe, expect, it } from "vitest";
import type { Category } from "@billie/parser";
import { calculateDre, listAvailablePeriods } from "../../services/dre_aggregator";
import type { ManualIncomeEntry, StoredTransaction } from "../../types";

const CATEGORIES: Category[] = [
  { id: "housing", label: "Moradia", type: "expense", group: "fixed" },
  { id: "food", label: "Alimentação", type: "expense", group: "variable" },
  { id: "leisure", label: "Lazer", type: "expense", group: "variable" },
  { id: "salary", label: "Salário", type: "income" },
  { id: "freelance", label: "Freelance / PJ", type: "income" },
];

function buildTransaction(date: string, categoryId: string, amount: number): StoredTransaction {
  return { id: `${date}-${categoryId}-${amount}`, date, merchant: "x", amount, categoryId, origin: "pdf" };
}

function buildIncome(date: string, categoryId: string, amount: number): ManualIncomeEntry {
  return { id: `${date}-${categoryId}-${amount}`, date, description: "x", amount, categoryId };
}

describe("listAvailablePeriods", () => {
  it("lista os meses de despesas e receitas, sem repetir, do mais recente ao mais antigo", () => {
    const transactions = [buildTransaction("2026-01-10", "food", 10), buildTransaction("2026-03-05", "food", 10)];
    const income = [buildIncome("2026-03-01", "salary", 100), buildIncome("2025-12-20", "salary", 100)];

    expect(listAvailablePeriods(transactions, income)).toEqual(["2026-03", "2026-01", "2025-12"]);
  });

  it("devolve lista vazia sem dados", () => {
    expect(listAvailablePeriods([], [])).toEqual([]);
  });
});

describe("calculateDre", () => {
  const transactions = [
    buildTransaction("2026-03-01", "housing", 1500),
    buildTransaction("2026-03-05", "food", 300),
    buildTransaction("2026-03-06", "food", 200),
    buildTransaction("2026-03-07", "leisure", 100),
    buildTransaction("2026-02-10", "food", 999),
  ];
  const income = [
    buildIncome("2026-03-05", "salary", 4000),
    buildIncome("2026-03-20", "freelance", 1000),
    buildIncome("2026-02-05", "salary", 4000),
  ];

  it("soma receitas e despesas fixas/variáveis só do mês pedido", () => {
    const dre = calculateDre("2026-03", transactions, income, CATEGORIES);

    expect(dre).toMatchObject({
      period: "2026-03",
      totalIncome: 5000,
      fixedExpenses: 1500,
      variableExpenses: 600,
      result: 2900,
    });
  });

  it("agrupa por categoria, do maior para o menor total, omitindo categorias zeradas", () => {
    const dre = calculateDre("2026-03", transactions, income, CATEGORIES);

    expect(dre.expenseCategories).toEqual([
      { categoryId: "housing", label: "Moradia", group: "fixed", total: 1500 },
      { categoryId: "food", label: "Alimentação", group: "variable", total: 500 },
      { categoryId: "leisure", label: "Lazer", group: "variable", total: 100 },
    ]);
    expect(dre.incomeCategories).toEqual([
      { categoryId: "salary", label: "Salário", group: undefined, total: 4000 },
      { categoryId: "freelance", label: "Freelance / PJ", group: undefined, total: 1000 },
    ]);
  });

  it("não conta despesas de categorias que não existem mais na lista", () => {
    const dre = calculateDre("2026-03", [buildTransaction("2026-03-01", "removida", 50)], [], CATEGORIES);

    expect(dre.variableExpenses).toBe(0);
    expect(dre.expenseCategories).toEqual([]);
  });

  it("resultado negativo quando as despesas passam das receitas", () => {
    const dre = calculateDre("2026-02", transactions, [], CATEGORIES);

    expect(dre.result).toBe(-999);
  });
});
