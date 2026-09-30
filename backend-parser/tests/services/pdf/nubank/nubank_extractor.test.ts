import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractNubankFromLines } from "../../../../services/pdf/nubank/nubank_extractor";

function summarize(transactions: { date: string; merchant: string; amount: number }[]) {
  return transactions.map((t) => [t.date, t.merchant, t.amount]);
}

describe("extractNubankFromLines — fatura", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 10)); // abril de 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extrai as compras e ignora pagamentos, saldos e estornos", () => {
    const lines = [
      "Resumo da fatura atual",
      "15 MAR Padaria Pão Quente R$ 10,50",
      "16 MAR Uber •••• 1234 R$ 25,00",
      "20 MAR Pagamento em 20 MAR R$ 500,00",
      "21 MAR Saldo restante da fatura anterior R$ 80,00",
      "22 MAR Estorno Loja R$ -15,00",
    ];

    const result = extractNubankFromLines(lines, "2026");

    expect(summarize(result.expenses)).toEqual([
      ["2026-03-15", "Padaria Pão Quente", 10.5],
      ["2026-03-16", "Uber", 25],
    ]);
    expect(result.income).toEqual([]);
  });

  it("volta um ano para meses depois do mês atual (virada de ano)", () => {
    const result = extractNubankFromLines(["28 DEZ Mercado R$ 100,00"], "2026");

    expect(result.expenses[0].date).toBe("2025-12-28");
  });

  it("falha quando nenhuma linha é compra", () => {
    expect(() => extractNubankFromLines(["Resumo da fatura atual"], "2026")).toThrow(
      "Nenhuma transação encontrada no formato Nubank (fatura)."
    );
  });
});

describe("extractNubankFromLines — extrato", () => {
  const lines = [
    "Extrato de 1 de março de 2026 a 31 de março de 2026",
    "Rendimento líquido +12,34",
    "Movimentações",
    "01 MAR 2026 Total de entradas + 3.000,00",
    "Transferência recebida pelo Pix 3.000,00",
    "FULANO DE TAL",
    "Total de saídas - 60,50",
    "Compra no débito 50,00",
    "Padaria Pão Quente",
    "Transferência enviada pelo Pix 10,50",
    "Tem alguma dúvida? Fale com a gente",
    "Linha de rodapé que não deve virar descrição",
    "02 MAR 2026 Total de saídas - 20,00",
    "Uber 20,00",
    "O saldo líquido corresponde ao total de depósitos menos as saídas",
    "03 MAR 2026 Total de saídas - 99,00",
    "Depois do fim 99,00",
  ];

  it("é detectado pela linha 'Movimentações'", () => {
    const result = extractNubankFromLines(lines, "2026");

    expect(result.income.length).toBeGreaterThan(0);
  });

  it("separa entradas e saídas pelos cabeçalhos e junta descrições em várias linhas", () => {
    const result = extractNubankFromLines(lines, "2026");

    expect(summarize(result.expenses)).toEqual([
      ["2026-03-01", "Compra no débito Padaria Pão Quente", 50],
      ["2026-03-01", "Transferência enviada pelo Pix", 10.5],
      ["2026-03-02", "Uber", 20],
    ]);
    expect(summarize(result.income)).toEqual([
      ["2026-03-01", "Transferência recebida pelo Pix FULANO DE TAL", 3000],
      ["2026-03-31", "Rendimento líquido", 12.34],
    ]);
  });

  it("usa o ano do cabeçalho do dia, não o parâmetro", () => {
    const result = extractNubankFromLines(lines, "2020");

    expect(result.expenses[0].date).toBe("2026-03-01");
  });
});
