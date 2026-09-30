import { describe, expect, it } from "vitest";
import { exportToCsv } from "../../../services/csv/csv_exporter";

const BOM = "﻿";

describe("exportToCsv", () => {
  it("gera CSV com BOM, ';' como delimitador e vírgula decimal", () => {
    const csv = exportToCsv([{ id: "1", date: "2026-03-01", merchant: "Padaria", amount: 10.5 }]);

    expect(csv).toBe(`${BOM}date;merchant;amount\n2026-03-01;Padaria;10,5`);
  });

  it("usa os nomes de coluna informados", () => {
    const csv = exportToCsv([], { date: "Data", merchant: "Descrição", amount: "Valor" });

    expect(csv).toBe(`${BOM}Data;Descrição;Valor`);
  });

  it("coloca entre aspas campos com delimitador, aspas ou quebra de linha", () => {
    const csv = exportToCsv([{ id: "1", date: "2026-03-01", merchant: 'Loja; "Centro"', amount: 1 }]);

    expect(csv.split("\n")[1]).toBe('2026-03-01;"Loja; ""Centro""";1');
  });

  it("neutraliza descrições que o Excel interpretaria como fórmula", () => {
    const csv = exportToCsv([{ id: "1", date: "2026-03-01", merchant: "=HYPERLINK(\"x\")", amount: 1 }]);

    expect(csv.split("\n")[1]).toBe('2026-03-01;"\'=HYPERLINK(""x"")";1');
  });
});
