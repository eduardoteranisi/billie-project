import { afterEach, describe, expect, it, vi } from "vitest";
import {
  finalizeCsvTransactions,
  finalizeTransactions,
  formatIsoDate,
  generateTransactionId,
  parseAmount,
  parseTransactionDate,
} from "../../services/transaction_processor";

describe("parseAmount", () => {
  it("lê o formato brasileiro com milhar e vírgula decimal", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
  });

  it("ignora o prefixo R$ e espaços", () => {
    expect(parseAmount("R$ 1.234,56")).toBe(1234.56);
    expect(parseAmount("R$1 234,56")).toBe(1234.56);
  });

  it("mantém o sinal negativo", () => {
    expect(parseAmount("-50,00")).toBe(-50);
  });

  it("aceita ponto como decimal quando não há vírgula", () => {
    expect(parseAmount("12.5")).toBe(12.5);
  });
});

describe("parseTransactionDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lê datas ISO", () => {
    expect(parseTransactionDate("2026-03-15")).toEqual(new Date(2026, 2, 15));
  });

  it("lê datas dd/mm/aaaa", () => {
    expect(parseTransactionDate("15/03/2026")).toEqual(new Date(2026, 2, 15));
  });

  it("completa anos de dois dígitos com 2000", () => {
    expect(parseTransactionDate("15/03/26")).toEqual(new Date(2026, 2, 15));
  });

  it("usa o ano atual quando a data não tem ano", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 5, 1));

    expect(parseTransactionDate("15/03")).toEqual(new Date(2027, 2, 15));
  });
});

describe("formatIsoDate", () => {
  it("formata a data como aaaa-mm-dd", () => {
    expect(formatIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("generateTransactionId", () => {
  const date = new Date(2026, 2, 15);

  it("gera o mesmo id para a mesma transação", () => {
    expect(generateTransactionId(date, "Padaria", 10)).toBe(generateTransactionId(date, "Padaria", 10));
  });

  it("ignora acentos, maiúsculas e pontuação da descrição", () => {
    expect(generateTransactionId(date, "Padaria São João", 10)).toBe(
      generateTransactionId(date, "PADARIA SAO JOAO!", 10)
    );
  });

  it("muda quando data, descrição ou valor mudam", () => {
    const baseId = generateTransactionId(date, "Padaria", 10);

    expect(generateTransactionId(new Date(2026, 2, 16), "Padaria", 10)).not.toBe(baseId);
    expect(generateTransactionId(date, "Mercado", 10)).not.toBe(baseId);
    expect(generateTransactionId(date, "Padaria", 11)).not.toBe(baseId);
  });
});

describe("finalizeTransactions", () => {
  it("converte linhas brutas em transações tipadas", () => {
    const [transaction] = finalizeTransactions([
      { date: "15/03/2026", dirtyDescription: "Padaria", rawAmount: "10,50" },
    ]);

    expect(transaction).toEqual({
      id: generateTransactionId(new Date(2026, 2, 15), "Padaria", 10.5),
      date: "2026-03-15",
      merchant: "Padaria",
      amount: 10.5,
    });
  });

  it("move parcelas para o mês/ano predominante da fatura", () => {
    const transactions = finalizeTransactions([
      { date: "10/03/2026", dirtyDescription: "Mercado", rawAmount: "100,00" },
      { date: "12/03/2026", dirtyDescription: "Farmácia", rawAmount: "50,00" },
      { date: "15/01/2026", dirtyDescription: "Loja 03/10", rawAmount: "80,00" },
    ]);

    expect(transactions.map((t) => t.date)).toEqual(["2026-03-10", "2026-03-12", "2026-03-15"]);
  });

  it("reconhece a palavra 'parcela' como parcelamento", () => {
    const transactions = finalizeTransactions([
      { date: "10/03/2026", dirtyDescription: "Mercado", rawAmount: "100,00" },
      { date: "15/01/2026", dirtyDescription: "Loja Parcela 3 de 10", rawAmount: "80,00" },
    ]);

    expect(transactions[1].date).toBe("2026-03-15");
  });

  it("ajusta o dia da parcela ao último dia do mês da fatura", () => {
    const transactions = finalizeTransactions([
      { date: "10/02/2026", dirtyDescription: "Mercado", rawAmount: "100,00" },
      { date: "31/01/2026", dirtyDescription: "Loja 02/05", rawAmount: "80,00" },
    ]);

    expect(transactions[1].date).toBe("2026-02-28");
  });

  it("não mexe nas datas quando só há parcelas", () => {
    const transactions = finalizeTransactions([
      { date: "15/01/2026", dirtyDescription: "Loja 03/10", rawAmount: "80,00" },
    ]);

    expect(transactions[0].date).toBe("2026-01-15");
  });
});

describe("finalizeCsvTransactions", () => {
  it("usa a flag isInstallment da linha em vez da descrição", () => {
    const transactions = finalizeCsvTransactions([
      { date: "2026-03-10", merchant: "Mercado", rawAmount: "100,00", isInstallment: false },
      { date: "2026-01-15", merchant: "Loja sem marcação", rawAmount: "80,00", isInstallment: true },
      { date: "2026-01-20", merchant: "Loja 03/10", rawAmount: "30,00", isInstallment: false },
    ]);

    expect(transactions.map((t) => t.date)).toEqual(["2026-03-10", "2026-03-15", "2026-01-20"]);
  });
});
