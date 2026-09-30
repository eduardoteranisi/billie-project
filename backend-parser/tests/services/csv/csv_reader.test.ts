import { describe, expect, it } from "vitest";
import { parseCsvInvoice } from "../../../services/csv/csv_reader";
import { CsvColumnMappingError } from "../../../services/csv/csv_column_mapping_error";

describe("parseCsvInvoice", () => {
  it("fatura: todas as linhas viram despesa e pagamentos/estornos são descartados", async () => {
    const csv = [
      "Data;Estabelecimento;Valor",
      "01/03/2026;Padaria;10,50",
      "02/03/2026;Pagamento recebido;500,00",
      "03/03/2026;Uber;25,00",
    ].join("\n");

    const result = await parseCsvInvoice(csv);

    expect(result.expenses.map((t) => [t.date, t.merchant, t.amount])).toEqual([
      ["2026-03-01", "Padaria", 10.5],
      ["2026-03-03", "Uber", 25],
    ]);
    expect(result.income).toEqual([]);
  });

  it("extrato: separa por sinal e guarda despesas com valor positivo", async () => {
    const csv = [
      "Data;Descrição;Valor",
      "01/03/2026;Pix enviado - João;-50,00",
      "02/03/2026;Salário;3.000,00",
      "03/03/2026;Padaria;-10,50",
    ].join("\n");

    const result = await parseCsvInvoice(csv);

    expect(result.expenses.map((t) => [t.merchant, t.amount])).toEqual([
      ["Pix enviado - João", 50],
      ["Padaria", 10.5],
    ]);
    expect(result.income.map((t) => [t.merchant, t.amount])).toEqual([["Salário", 3000]]);
  });

  it("descarta linhas incompletas ou com valor zero", async () => {
    const csv = [
      "Data;Estabelecimento;Valor",
      "01/03/2026;Padaria;10,50",
      "02/03/2026;;20,00",
      "03/03/2026;Brinde;0,00",
      ";Sem data;5,00",
    ].join("\n");

    const result = await parseCsvInvoice(csv);

    expect(result.expenses.map((t) => t.merchant)).toEqual(["Padaria"]);
  });

  it("usa a coluna de parcela para corrigir a data das parcelas", async () => {
    const csv = [
      "Data;Estabelecimento;Valor;Parcela",
      "10/03/2026;Mercado;100,00;",
      "15/01/2026;Loja;80,00;3/10",
      "20/03/2026;Farmácia;30,00;-",
    ].join("\n");

    const result = await parseCsvInvoice(csv);

    expect(result.expenses.map((t) => t.date)).toEqual(["2026-03-10", "2026-03-15", "2026-03-20"]);
  });

  it("aceita um mapeamento manual de colunas", async () => {
    const csv = ["Quando;Onde;Quanto", "01/03/2026;Padaria;10,50"].join("\n");

    const result = await parseCsvInvoice(csv, { date: "Quando", merchant: "Onde", amount: "Quanto" });

    expect(result.expenses.map((t) => t.merchant)).toEqual(["Padaria"]);
  });

  it("lança CsvColumnMappingError quando não reconhece as colunas", async () => {
    const csv = ["Quando;Onde;Quanto", "01/03/2026;Padaria;10,50"].join("\n");

    const error = await parseCsvInvoice(csv).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CsvColumnMappingError);
    expect(error).toMatchObject({
      headers: ["Quando", "Onde", "Quanto"],
      missingRoles: ["date", "merchant", "amount"],
    });
  });

  it("falha quando não sobra nenhuma transação válida", async () => {
    const csv = ["Data;Estabelecimento;Valor", "01/03/2026;Brinde;0,00"].join("\n");

    await expect(parseCsvInvoice(csv)).rejects.toThrow("Nenhuma transação válida encontrada no CSV.");
  });
});
