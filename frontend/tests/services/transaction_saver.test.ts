import { describe, expect, it } from "vitest";
import { somarResultadosSalvamento } from "../../services/transaction_saver";

// classificarESalvarTransacoes e salvarIncomeNoControle dependem do IndexedDB (expense_store.ts)
// e entram na fatia com fake-indexeddb (ADR 0006).
describe("somarResultadosSalvamento", () => {
  it("soma adicionados e duplicados de vários salvamentos", () => {
    expect(
      somarResultadosSalvamento({ added: 3, duplicates: 1 }, { added: 2, duplicates: 0 }, { added: 0, duplicates: 4 })
    ).toEqual({ added: 5, duplicates: 5 });
  });

  it("devolve zero sem nenhum salvamento", () => {
    expect(somarResultadosSalvamento()).toEqual({ added: 0, duplicates: 0 });
  });
});
