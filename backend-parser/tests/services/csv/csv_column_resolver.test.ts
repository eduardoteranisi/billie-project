import { describe, expect, it } from "vitest";
import { isColumnResolutionFailure, resolveColumns } from "../../../services/csv/csv_column_resolver";

describe("resolveColumns", () => {
  it("encontra as colunas por apelido, ignorando acentos e maiúsculas", () => {
    expect(resolveColumns(["Data", "Descrição", "Valor (R$)"])).toEqual({
      date: 0,
      merchant: 1,
      amount: 2,
      installment: null,
    });
  });

  it("encontra apelidos em inglês e a coluna de parcela", () => {
    expect(resolveColumns(["amount", "installment", "date", "title"])).toEqual({
      date: 2,
      merchant: 3,
      amount: 0,
      installment: 1,
    });
  });

  it("devolve uma falha com os papéis que faltaram", () => {
    const result = resolveColumns(["Quando", "Descrição", "Quanto"]);

    expect(result).toEqual({ headers: ["Quando", "Descrição", "Quanto"], missingRoles: ["date", "amount"] });
    expect(isColumnResolutionFailure(result)).toBe(true);
  });

  it("usa o mapeamento manual quando informado", () => {
    const result = resolveColumns(["Quando", "Onde", "Quanto"], {
      date: "quando",
      merchant: "ONDE",
      amount: "Quanto",
    });

    expect(result).toEqual({ date: 0, merchant: 1, amount: 2, installment: null });
    expect(isColumnResolutionFailure(result)).toBe(false);
  });

  it("no mapeamento manual, procura a parcela pelo apelido se ela não foi informada", () => {
    expect(resolveColumns(["Quando", "Onde", "Quanto", "Parcela"], {
      date: "Quando",
      merchant: "Onde",
      amount: "Quanto",
    })).toEqual({ date: 0, merchant: 1, amount: 2, installment: 3 });
  });

  it("no mapeamento manual, falha se a coluna não existe", () => {
    expect(() =>
      resolveColumns(["Quando", "Onde"], { date: "Quando", merchant: "Onde", amount: "Quanto" })
    ).toThrow('Coluna "Quanto" (amount) não encontrada no CSV.');
  });
});
