import { describe, expect, it } from "vitest";
import { groupItemsIntoLines } from "../../../services/pdf/pdf_text_extractor";

describe("groupItemsIntoLines", () => {
  it("agrupa itens com Y próximo na mesma linha, de cima para baixo e da esquerda para a direita", () => {
    const lines = groupItemsIntoLines([
      { str: "10,50", x: 300, y: 700, width: 30 },
      { str: "Segunda linha", x: 10, y: 680, width: 80 },
      { str: "15 MAR", x: 10, y: 701, width: 40 },
      { str: "Padaria", x: 60, y: 699, width: 50 },
    ]);

    expect(lines).toEqual(["15 MAR Padaria 10,50", "Segunda linha"]);
  });

  it("junta sem espaço itens colados (palavras quebradas letra a letra)", () => {
    const lines = groupItemsIntoLines([
      { str: "P", x: 10, y: 500, width: 6 },
      { str: "I", x: 16.5, y: 500, width: 3 },
      { str: "X", x: 20, y: 500, width: 6 },
      { str: "ENVIADO", x: 40, y: 500, width: 50 },
    ]);

    expect(lines).toEqual(["PIX ENVIADO"]);
  });

  it("devolve lista vazia sem itens", () => {
    expect(groupItemsIntoLines([])).toEqual([]);
  });
});
