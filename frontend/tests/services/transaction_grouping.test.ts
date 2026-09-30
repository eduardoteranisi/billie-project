import { describe, expect, it } from "vitest";
import type { Bank } from "@billie/parser";
import {
  groupTransactionsByBank,
  groupTransactionsByDay,
  UNKNOWN_BANK_LABEL,
} from "../../services/transaction_grouping";

interface Row {
  id: string;
  date: string;
  amount: number;
  bank?: Bank;
}

const rows: Row[] = [
  { id: "1", date: "2026-03-02", amount: 10, bank: "Nubank" },
  { id: "2", date: "2026-03-01", amount: 5 },
  { id: "3", date: "2026-03-02", amount: 100, bank: "Santander" },
  { id: "4", date: "2026-03-01", amount: 20, bank: "Nubank" },
];

describe("groupTransactionsByBank", () => {
  it("agrupa por banco, do maior total ao menor, com 'não identificado' por último", () => {
    const groups = groupTransactionsByBank(rows);

    expect(groups.map((g) => [g.label, g.total, g.transactions.map((t) => t.id)])).toEqual([
      ["Santander", 100, ["3"]],
      ["Nubank", 30, ["1", "4"]],
      [UNKNOWN_BANK_LABEL, 5, ["2"]],
    ]);
  });

  it("não cria o grupo 'não identificado' se todas têm banco", () => {
    const groups = groupTransactionsByBank(rows.filter((row) => row.bank));

    expect(groups.map((g) => g.key)).toEqual(["Santander", "Nubank"]);
  });

  it("devolve lista vazia sem transações", () => {
    expect(groupTransactionsByBank([])).toEqual([]);
  });
});

describe("groupTransactionsByDay", () => {
  it("agrupa por dia, em ordem cronológica, somando os valores", () => {
    const groups = groupTransactionsByDay(rows);

    expect(groups.map((g) => [g.key, g.total, g.transactions.map((t) => t.id)])).toEqual([
      ["2026-03-01", 25, ["2", "4"]],
      ["2026-03-02", 110, ["1", "3"]],
    ]);
  });
});
