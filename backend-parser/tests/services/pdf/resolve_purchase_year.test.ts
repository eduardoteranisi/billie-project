import { describe, expect, it } from "vitest";
import { resolvePurchaseYear } from "../../../services/pdf/resolve_purchase_year";

// "agora" em março de 2026 (getMonth() === 2, ou seja, mês 3)
const NOW = new Date(2026, 2, 10);

describe("resolvePurchaseYear", () => {
  it("usa o ano informado sem ajuste de virada por padrão", () => {
    expect(resolvePurchaseYear(12, "2025", NOW)).toBe(2025);
    expect(resolvePurchaseYear(2, "2025", NOW)).toBe(2025);
  });

  it("sem ano informado, usa o ano atual para meses até o atual", () => {
    expect(resolvePurchaseYear(3, "", NOW)).toBe(2026);
    expect(resolvePurchaseYear(1, "", NOW)).toBe(2026);
  });

  it("sem ano informado, volta um ano para meses depois do atual", () => {
    expect(resolvePurchaseYear(4, "", NOW)).toBe(2025);
    expect(resolvePurchaseYear(12, "", NOW)).toBe(2025);
  });

  it("com alwaysAdjustForRollover, ajusta a virada mesmo com ano informado", () => {
    expect(resolvePurchaseYear(12, "2026", NOW, { alwaysAdjustForRollover: true })).toBe(2025);
    expect(resolvePurchaseYear(3, "2026", NOW, { alwaysAdjustForRollover: true })).toBe(2026);
  });

  it("explicitYear tem prioridade sobre tudo", () => {
    expect(resolvePurchaseYear(12, "", NOW, { explicitYear: 2020, alwaysAdjustForRollover: true })).toBe(2020);
  });
});
