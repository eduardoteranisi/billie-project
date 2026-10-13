import { describe, expect, it } from "vitest";
import { DEFAULT_CSV_COLUMNS } from "@billie/parser";
import {
  convertLegacyBackupPayloadToCurrent,
  convertLegacyExpenseToStoredExpense,
  convertSavedCsvColumnsToCurrent,
  type LegacyStoredExpense,
} from "../../services/legacy_data_conversion";

const LEGACY_EXPENSE: LegacyStoredExpense = {
  id: "a",
  date: "2026-03-01",
  merchant: "Padaria",
  amount: 10,
  categoryId: "food",
  origin: "pdf",
  bank: "Nubank",
  detailsOverridden: true,
};

describe("convertLegacyExpenseToStoredExpense", () => {
  it("troca `merchant` por `description` e mantém todos os outros campos", () => {
    expect(convertLegacyExpenseToStoredExpense(LEGACY_EXPENSE)).toEqual({
      id: "a",
      date: "2026-03-01",
      description: "Padaria",
      amount: 10,
      categoryId: "food",
      origin: "pdf",
      bank: "Nubank",
      detailsOverridden: true,
    });
  });

  it("não deixa a chave `merchant` na despesa convertida", () => {
    expect(convertLegacyExpenseToStoredExpense(LEGACY_EXPENSE)).not.toHaveProperty("merchant");
  });
});

describe("convertLegacyBackupPayloadToCurrent", () => {
  it("passa as despesas de `transactions` para `expenses` e sobe a versão do formato", () => {
    const income = [{ id: "b", date: "2026-03-05", description: "Salário", amount: 100, categoryId: "salary" }];
    const categories = [{ id: "salary", label: "Salário", type: "income" as const }];
    const categoryRules = [{ categoryId: "salary", keywords: ["SALARIO"] }];

    const converted = convertLegacyBackupPayloadToCurrent({
      schemaVersion: 1,
      exportedAt: "2026-09-01T12:00:00.000Z",
      transactions: [LEGACY_EXPENSE],
      income,
      categories,
      categoryRules,
    });

    expect(converted).toEqual({
      schemaVersion: 2,
      exportedAt: "2026-09-01T12:00:00.000Z",
      expenses: [convertLegacyExpenseToStoredExpense(LEGACY_EXPENSE)],
      income,
      categories,
      categoryRules,
    });
  });
});

describe("convertSavedCsvColumnsToCurrent", () => {
  it("mantém o nome de coluna que o usuário escolheu na configuração antiga", () => {
    expect(
      convertSavedCsvColumnsToCurrent({ date: "Data", merchant: "Estabelecimento", amount: "Valor" }, DEFAULT_CSV_COLUMNS)
    ).toEqual({ date: "Data", description: "Estabelecimento", amount: "Valor" });
  });

  it("usa o padrão novo quando a configuração antiga guardava o padrão antigo", () => {
    expect(
      convertSavedCsvColumnsToCurrent({ date: "Data", merchant: "merchant", amount: "amount" }, DEFAULT_CSV_COLUMNS)
    ).toEqual({ date: "Data", description: "description", amount: "amount" });
  });

  it("lê a configuração atual sem alterar", () => {
    expect(
      convertSavedCsvColumnsToCurrent({ date: "Data", description: "Loja", amount: "Valor" }, DEFAULT_CSV_COLUMNS)
    ).toEqual({ date: "Data", description: "Loja", amount: "Valor" });
  });

  it("completa com o padrão as colunas que não foram salvas", () => {
    expect(convertSavedCsvColumnsToCurrent({}, DEFAULT_CSV_COLUMNS)).toEqual(DEFAULT_CSV_COLUMNS);
  });
});
