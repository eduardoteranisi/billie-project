import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractXpRicoFromLines } from "../../../../services/pdf/xp-rico/xp_rico_extractor";

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

describe("extractXpRicoFromLines — fatura", () => {
  it("extrai as compras e ignora pagamentos, estornos e linhas com R$", () => {
    const lines = [
      "Fatura do cartão",
      "15/03 Padaria 10,50",
      "16/03 Loja Online 100,00 20,00",
      "17/03 Pagamento recebido 500,00",
      "18/03 Estorno Loja -15,00",
      "19/03 Total em R$ 1.000,00",
    ];

    const result = extractXpRicoFromLines(lines, "2026");

    expect(summarize(result.expenses)).toEqual([
      ["2026-03-15", "Padaria", 10.5],
      ["2026-03-16", "Loja Online", 100],
    ]);
    expect(result.income).toEqual([]);
  });

  it("usa o ano escrito na linha quando existe", () => {
    const result = extractXpRicoFromLines(["15/12/25 Mercado 80,00", "16/03/2026 Uber 20,00"], "2026");

    expect(result.expenses.map((t) => t.date)).toEqual(["2025-12-15", "2026-03-16"]);
  });

  it("falha quando nenhuma linha é compra", () => {
    expect(() => extractXpRicoFromLines(["Fatura do cartão"], "2026")).toThrow(
      "Nenhuma transação encontrada no formato XP (fatura)."
    );
  });
});

describe("extractXpRicoFromLines — extrato", () => {
  it("é detectado pela palavra 'extrato' e separa débitos e créditos pelo sinal", () => {
    const lines = [
      "Extrato da conta",
      "01/03/2026 às",
      "Pix recebido Fulano R$ 1.000,00 R$ 1.500,00",
      "02/03/26 Pix enviado Padaria -R$ 50,00 R$ 1.450,00",
    ];

    const result = extractXpRicoFromLines(lines, "2026");

    expect(summarize(result.expenses)).toEqual([["2026-03-02", "Pix enviado Padaria", 50]]);
    expect(summarize(result.income)).toEqual([["2026-03-01", "Pix recebido Fulano", 1000]]);
  });

  it("falha quando nenhuma linha é movimentação", () => {
    expect(() => extractXpRicoFromLines(["Extrato da conta"], "2026")).toThrow(
      "Nenhuma transação encontrada no formato XP (extrato)."
    );
  });
});
