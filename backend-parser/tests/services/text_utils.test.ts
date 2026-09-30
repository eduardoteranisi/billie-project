import { describe, expect, it } from "vitest";
import { normalizeText } from "../../services/text_utils";

describe("normalizeText", () => {
  it("converte para maiúsculas e remove acentos", () => {
    expect(normalizeText("Descrição da transação")).toBe("DESCRICAO DA TRANSACAO");
  });

  it("mantém números e pontuação", () => {
    expect(normalizeText("Valor (R$) 1.234,56")).toBe("VALOR (R$) 1.234,56");
  });
});
