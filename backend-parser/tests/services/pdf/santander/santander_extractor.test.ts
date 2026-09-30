import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractSantanderFromLines } from "../../../../services/pdf/santander/santander_extractor";

function summarize(transactions: { date: string; merchant: string; amount: number }[]) {
  return transactions.map((t) => [t.date, t.merchant, t.amount]);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 3, 10)); // abril de 2026
});

afterEach(() => {
  vi.useRealTimers();
});

describe("extractSantanderFromLines — fatura", () => {
  it("extrai várias compras por linha e ignora pagamentos, encargos e créditos", () => {
    const lines = [
      "Detalhamento da fatura",
      "15/03 PADARIA 10,50 16/03 UBER TRIP 20,00",
      "17/03 PAGAMENTO DE FATURA 500,00",
      "18/03 IOF COMPRA 1,20",
      "19/03 LOJA -15,00",
    ];

    const result = extractSantanderFromLines(lines, "2026");

    expect(summarize(result.expenses)).toEqual([
      ["2026-03-15", "PADARIA", 10.5],
      ["2026-03-16", "UBER TRIP", 20],
    ]);
    expect(result.income).toEqual([]);
  });

  it("junta valores quebrados entre duas linhas", () => {
    const result = extractSantanderFromLines(["17/03 FARMACIA 30,", "00"], "2026");

    expect(summarize(result.expenses)).toEqual([["2026-03-17", "FARMACIA", 30]]);
  });

  it("falha quando nenhuma linha é compra", () => {
    expect(() => extractSantanderFromLines(["Detalhamento da fatura"], "2026")).toThrow(
      "Nenhuma transação encontrada no formato Santander (fatura)."
    );
  });
});

describe("extractSantanderFromLines — extrato", () => {
  const lines = [
    "Extrato Consolidado Inteligente",
    "Movimentação",
    "01/03 PIX RECEBIDO FULANO - 1.000,00 5.000,00",
    "PIX ENVIADO PADARIA 123456 50,00- 4.950,00",
    "DETALHE DA TRANSFERENCIA",
    "Linha solta que não é continuação",
    "Pagina: 1/2",
    "02/03 TARIFA MENSAL - 20,00-",
    "Saldos por período",
    "03/03 DEPOIS DO FIM - 1,00",
  ];

  it("é detectado pelo título 'Extrato Consolidado Inteligente'", () => {
    const result = extractSantanderFromLines(lines, "2026");

    expect(result.income.length).toBeGreaterThan(0);
  });

  it("separa débitos (valor com '-' no fim) de créditos e herda a data da linha anterior", () => {
    const result = extractSantanderFromLines(lines, "2026");

    expect(summarize(result.expenses)).toEqual([
      ["2026-03-01", "PIX ENVIADO PADARIA DETALHE DA TRANSFERENCIA", 50],
      ["2026-03-02", "TARIFA MENSAL", 20],
    ]);
    expect(summarize(result.income)).toEqual([["2026-03-01", "PIX RECEBIDO FULANO", 1000]]);
  });

  it("falha quando nenhuma linha é movimentação", () => {
    expect(() => extractSantanderFromLines(["Extrato Consolidado Inteligente", "Movimentação"], "2026")).toThrow(
      "Nenhuma transação encontrada no formato Santander (extrato)."
    );
  });
});
