import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runPipeline, type Transaction } from "@billie/parser";
import { classifyAndSaveExpenseList, classifyAndSaveIncomeList } from "../../services/transaction_saver";
import {
  parseCsvStatementText,
  parsePdfStatementFile,
  saveParsedStatementToFinanceStore,
} from "../../services/statement_importer";
import { STORED_DATA_UPDATED_EVENT } from "../../services/stored_data_events";

vi.mock("@billie/parser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@billie/parser")>()),
  runPipeline: vi.fn(),
}));

// as funções de salvamento dependem do IndexedDB (finance_store.ts)
vi.mock("../../services/transaction_saver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/transaction_saver")>()),
  classifyAndSaveExpenseList: vi.fn(),
  classifyAndSaveIncomeList: vi.fn(),
}));

function buildTransaction(id: string): Transaction {
  return { id, date: "2026-03-01", description: `Loja ${id}`, amount: 10, installment: null } as Transaction;
}

describe("parsePdfStatementFile", () => {
  afterEach(() => {
    vi.mocked(runPipeline).mockReset();
  });

  it("envia os bytes e as opções do PDF para o pipeline e devolve despesas e receitas", async () => {
    const expense = buildTransaction("a");
    const income = buildTransaction("b");
    vi.mocked(runPipeline).mockResolvedValue({ success: true, transactions: [expense], income: [income] });

    const file = new File([new Uint8Array([1, 2, 3])], "fatura.pdf", { type: "application/pdf" });
    const statement = await parsePdfStatementFile(file, { bank: "Nubank", year: "2026", password: "123" });

    expect(statement).toEqual({ expenses: [expense], income: [income] });
    expect(runPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "pdf",
        pdfBytes: new Uint8Array([1, 2, 3]),
        bank: "Nubank",
        year: "2026",
        password: "123",
      })
    );
  });

  it("devolve receitas vazias quando o pipeline não informa receitas", async () => {
    vi.mocked(runPipeline).mockResolvedValue({ success: true, transactions: [] });

    const statement = await parsePdfStatementFile(new File([], "fatura.pdf"), { bank: "Nubank", year: "2026" });

    expect(statement.income).toEqual([]);
  });

  it("lança o erro do pipeline quando o processamento falha", async () => {
    vi.mocked(runPipeline).mockResolvedValue({ success: false, error: "senha incorreta" });

    await expect(parsePdfStatementFile(new File([], "fatura.pdf"), { bank: "Nubank", year: "2026" })).rejects.toThrow(
      "senha incorreta"
    );
  });
});

describe("parseCsvStatementText", () => {
  afterEach(() => {
    vi.mocked(runPipeline).mockReset();
  });

  it("devolve o extrato processado", async () => {
    const expense = buildTransaction("a");
    vi.mocked(runPipeline).mockResolvedValue({ success: true, transactions: [expense], income: [] });

    const result = await parseCsvStatementText("data;valor", { bank: "Santander" });

    expect(result).toEqual({ status: "parsed", statement: { expenses: [expense], income: [] } });
  });

  it("pede o mapeamento manual quando as colunas não são identificadas", async () => {
    vi.mocked(runPipeline).mockResolvedValue({
      success: false,
      needsColumnMapping: { headers: ["Quando", "Quanto"], missingRoles: ["date"] },
    });

    const result = await parseCsvStatementText("Quando;Quanto", { bank: "Santander" });

    expect(result).toEqual({ status: "needsColumnMapping", headers: ["Quando", "Quanto"] });
  });

  it("lança o erro do pipeline quando o processamento falha", async () => {
    vi.mocked(runPipeline).mockResolvedValue({ success: false, error: "CSV vazio" });

    await expect(parseCsvStatementText("", { bank: "Santander" })).rejects.toThrow("CSV vazio");
  });
});

describe("saveParsedStatementToFinanceStore", () => {
  const dispatchEvent = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("document", { dispatchEvent });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    dispatchEvent.mockReset();
  });

  it("salva despesas e receitas, soma os resultados e avisa a tela de Controle de Gastos", async () => {
    vi.mocked(classifyAndSaveExpenseList).mockResolvedValue({ added: 3, duplicates: 1 });
    vi.mocked(classifyAndSaveIncomeList).mockResolvedValue({ added: 2, duplicates: 0 });
    const statement = { expenses: [buildTransaction("a")], income: [buildTransaction("b")] };

    const result = await saveParsedStatementToFinanceStore(statement, "pdf");

    expect(result).toEqual({ added: 5, duplicates: 1 });
    expect(classifyAndSaveExpenseList).toHaveBeenCalledWith(statement.expenses, "pdf");
    expect(classifyAndSaveIncomeList).toHaveBeenCalledWith(statement.income);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: STORED_DATA_UPDATED_EVENT }));
  });
});
