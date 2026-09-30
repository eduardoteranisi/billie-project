import { describe, expect, it } from "vitest";
import { groupPossibleDuplicateRows } from "../../services/duplicate_detection";

interface Row {
  id: string;
  date: string;
  amount: number;
  duplicateDismissed?: boolean;
}

function ids(groups: Row[][]): string[][] {
  return groups.map((group) => group.map((row) => row.id));
}

describe("groupPossibleDuplicateRows", () => {
  it("agrupa linhas com a mesma data e o mesmo valor", () => {
    const rows: Row[] = [
      { id: "a", date: "2026-03-01", amount: 50 },
      { id: "b", date: "2026-03-02", amount: 50 },
      { id: "c", date: "2026-03-01", amount: 50 },
    ];

    expect(ids(groupPossibleDuplicateRows(rows))).toEqual([["a", "c"]]);
  });

  it("compara o valor com duas casas decimais", () => {
    const rows: Row[] = [
      { id: "a", date: "2026-03-01", amount: 0.1 + 0.2 },
      { id: "b", date: "2026-03-01", amount: 0.3 },
      { id: "c", date: "2026-03-01", amount: 0.31 },
    ];

    expect(ids(groupPossibleDuplicateRows(rows))).toEqual([["a", "b"]]);
  });

  it("não agrupa quando a data ou o valor são diferentes", () => {
    const rows: Row[] = [
      { id: "a", date: "2026-03-01", amount: 50 },
      { id: "b", date: "2026-03-02", amount: 50 },
      { id: "c", date: "2026-03-01", amount: 51 },
    ];

    expect(groupPossibleDuplicateRows(rows)).toEqual([]);
  });

  it("some com o grupo quando todas as linhas foram dispensadas", () => {
    const rows: Row[] = [
      { id: "a", date: "2026-03-01", amount: 50, duplicateDismissed: true },
      { id: "b", date: "2026-03-01", amount: 50, duplicateDismissed: true },
    ];

    expect(groupPossibleDuplicateRows(rows)).toEqual([]);
  });

  it("volta a sinalizar o grupo dispensado que ganha uma linha nova", () => {
    const rows: Row[] = [
      { id: "a", date: "2026-03-01", amount: 50, duplicateDismissed: true },
      { id: "b", date: "2026-03-01", amount: 50, duplicateDismissed: true },
      { id: "c", date: "2026-03-01", amount: 50 },
    ];

    expect(ids(groupPossibleDuplicateRows(rows))).toEqual([["a", "b", "c"]]);
  });

  it("não altera a lista recebida", () => {
    const rows: Row[] = [
      { id: "a", date: "2026-03-01", amount: 50 },
      { id: "b", date: "2026-03-01", amount: 50 },
    ];
    const snapshot = structuredClone(rows);

    groupPossibleDuplicateRows(rows);

    expect(rows).toEqual(snapshot);
  });
});
