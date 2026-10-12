import { describe, expect, it } from "vitest";
import { sumSaveResults } from "../../services/transaction_saver";

// classifyAndSaveExpenseList e classifyAndSaveIncomeList dependem do IndexedDB (finance_store.ts)
// e entram na fatia com fake-indexeddb (ADR 0006).
describe("somarResultadosSalvamento", () => {
  it("soma adicionados e duplicados de vários salvamentos", () => {
    expect(
      sumSaveResults({ added: 3, duplicates: 1 }, { added: 2, duplicates: 0 }, { added: 0, duplicates: 4 })
    ).toEqual({ added: 5, duplicates: 5 });
  });

  it("devolve zero sem nenhum salvamento", () => {
    expect(sumSaveResults()).toEqual({ added: 0, duplicates: 0 });
  });
});
