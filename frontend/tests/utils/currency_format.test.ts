import { describe, expect, it } from "vitest";
import { formatBrlCurrency } from "../../utils/currency_format";

describe("formatBrlCurrency", () => {
  it("formata no padrão brasileiro de moeda", () => {
    expect(formatBrlCurrency(1234.5)).toBe("R$ 1.234,50");
  });

  it("mantém o sinal de valores negativos", () => {
    expect(formatBrlCurrency(-10)).toBe("-R$ 10,00");
  });

  it("nunca devolve o texto original de um valor que não é número", () => {
    const notANumber = "<img src=x onerror=alert(1)>" as unknown as number;

    expect(formatBrlCurrency(notANumber)).toBe("R$\u00a0NaN");
  });
});
