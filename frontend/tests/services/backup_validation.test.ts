import { describe, expect, it } from "vitest";
import { BackupValidationError, readBackupPayload } from "../../services/backup_validation";
import type { StoredExpense, StoredIncome } from "../../types";

function buildExpense(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "a",
    date: "2026-03-01",
    description: "Padaria",
    amount: 10,
    categoryId: "food",
    origin: "pdf",
    ...overrides,
  };
}

function buildIncome(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "b", date: "2026-03-05", description: "Salário", amount: 100, categoryId: "salary", ...overrides };
}

function buildBackup(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    exportedAt: "2026-10-01T12:00:00.000Z",
    expenses: [buildExpense()],
    income: [buildIncome()],
    categories: [
      { id: "food", label: "Alimentação", type: "expense", group: "variable" },
      { id: "salary", label: "Salário", type: "income" },
    ],
    categoryRules: [{ categoryId: "food", keywords: ["PADARIA"] }],
    ...overrides,
  };
}

describe("readBackupPayload", () => {
  it("devolve um backup válido sem alterar os dados", () => {
    const expense: StoredExpense = {
      id: "a",
      date: "2026-03-01",
      description: "Padaria",
      amount: 10,
      categoryId: "food",
      origin: "csv",
      bank: "Santander",
      categoryOverridden: true,
      duplicateDismissed: false,
    };
    const income: StoredIncome = { id: "b", date: "2026-03-05", description: "Pix", amount: 50, categoryId: "salary" };

    const backup = readBackupPayload(buildBackup({ expenses: [expense], income: [income] }));

    expect(backup.expenses).toEqual([expense]);
    expect(backup.income).toEqual([income]);
    expect(backup.categories).toHaveLength(2);
    expect(backup.categoryRules).toEqual([{ categoryId: "food", keywords: ["PADARIA"] }]);
  });

  it("descarta os campos que o app não conhece", () => {
    const backup = readBackupPayload(
      buildBackup({
        expenses: [buildExpense({ extra: { muito: "grande" } })],
        categories: [{ id: "food", label: "Alimentação", type: "expense", group: "fixed", color: "red" }],
      })
    );

    expect(backup.expenses[0]).not.toHaveProperty("extra");
    expect(backup.categories[0]).toEqual({ id: "food", label: "Alimentação", type: "expense", group: "fixed" });
  });

  it("converte um backup da versão 1 e valida as despesas convertidas", () => {
    const { description, ...legacyExpense } = buildExpense();

    const backup = readBackupPayload(
      buildBackup({ schemaVersion: 1, expenses: undefined, transactions: [{ ...legacyExpense, merchant: description }] })
    );

    expect(backup.schemaVersion).toBe(2);
    expect(backup.expenses).toEqual([buildExpense()]);
  });

  it.each([
    ["description não é texto", { description: 123 }],
    ["amount não é número", { amount: "abc" }],
    ["amount não é finito", { amount: null }],
    ["id ausente", { id: undefined }],
    ["id vazio", { id: "" }],
    ["data fora do formato ISO", { date: "01/03/2026" }],
    ["data não é texto", { date: 20260301 }],
    ["banco desconhecido", { bank: "__proto__" }],
    ["origem desconhecida", { origin: "x" }],
    ["marcação que não é booleana", { categoryOverridden: "sim" }],
    ["descrição longa demais", { description: "a".repeat(1_001) }],
  ])("recusa uma despesa com %s", (_case, overrides) => {
    expect(() => readBackupPayload(buildBackup({ expenses: [buildExpense(), buildExpense(overrides)] }))).toThrow(
      "arquivo de backup inválido: despesa nº 2 está corrompida ou incompleta"
    );
  });

  it("recusa itens que não são objetos", () => {
    expect(() => readBackupPayload(buildBackup({ income: [null] }))).toThrow(BackupValidationError);
    expect(() => readBackupPayload(buildBackup({ income: [[buildIncome()]] }))).toThrow("receita nº 1");
    expect(() =>
      readBackupPayload(buildBackup({ schemaVersion: 1, expenses: undefined, transactions: ["texto"] }))
    ).toThrow("despesa nº 1");
  });

  it.each([
    ["despesa sem grupo válido", { id: "x", label: "X", type: "expense", group: "x\" onmouseover=\"alert(1)" }],
    ["tipo desconhecido", { id: "x", label: "X", type: "outro" }],
    ["label que não é texto", { id: "x", label: 1, type: "income" }],
  ])("recusa uma categoria com %s", (_case, category) => {
    expect(() => readBackupPayload(buildBackup({ categories: [category] }))).toThrow("categoria nº 1");
  });

  it("recusa uma regra cujas palavras-chave não são uma lista de textos", () => {
    expect(() => readBackupPayload(buildBackup({ categoryRules: [{ categoryId: "food", keywords: "PADARIA" }] }))).toThrow(
      "regra de categoria nº 1"
    );
    expect(() => readBackupPayload(buildBackup({ categoryRules: [{ categoryId: "food", keywords: [1] }] }))).toThrow(
      "regra de categoria nº 1"
    );
  });

  it("recusa uma lista com itens demais", () => {
    const income = Array.from({ length: 200_001 }, () => buildIncome());

    expect(() => readBackupPayload(buildBackup({ income }))).toThrow("mais de 200000 itens do tipo receita");
  });

  it("mantém as mensagens de arquivo inválido e de versão não suportada", () => {
    expect(() => readBackupPayload("texto")).toThrow("arquivo de backup inválido");
    expect(() => readBackupPayload([])).toThrow("arquivo de backup inválido");
    expect(() => readBackupPayload(buildBackup({ schemaVersion: 99 }))).toThrow(
      "versão do arquivo de backup não suportada"
    );
  });
});
