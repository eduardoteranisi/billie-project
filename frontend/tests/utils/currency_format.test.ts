import { describe, expect, it } from "vitest";
import { formatBrlCurrency } from "../../utils/currency_format";

describe("formatBrlCurrency", () => {
  it("formata no padrão brasileiro de moeda", () => {
    expect(formatBrlCurrency(1234.5)).toBe("R$ 1.234,50");
  });

  it("mantém o sinal de valores negativos", () => {
    expect(formatBrlCurrency(-10)).toBe("-R$ 10,00");
  });
});
