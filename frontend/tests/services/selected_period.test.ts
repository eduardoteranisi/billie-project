import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSelectedPeriod,
  SELECTED_PERIOD_CHANGED_EVENT,
  setSelectedPeriod,
  syncSelectedPeriodWithAvailableList,
} from "../../services/selected_period";

describe("selected_period", () => {
  const dispatchEvent = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("document", { dispatchEvent });
    setSelectedPeriod("2026-01");
    dispatchEvent.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("avisa as telas quando o período muda", () => {
    setSelectedPeriod("2026-02");

    expect(getSelectedPeriod()).toBe("2026-02");
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: SELECTED_PERIOD_CHANGED_EVENT }));
  });

  it("não avisa quando o período escolhido é o mesmo", () => {
    setSelectedPeriod("2026-01");

    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("mantém o período atual quando ele continua disponível", () => {
    expect(syncSelectedPeriodWithAvailableList(["2026-03", "2026-01"])).toBe("2026-01");
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("cai no primeiro período disponível quando o atual não existe mais", () => {
    expect(syncSelectedPeriodWithAvailableList(["2026-03", "2026-02"])).toBe("2026-03");
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("fica sem período quando não há nenhum disponível", () => {
    expect(syncSelectedPeriodWithAvailableList([])).toBe("");
  });
});
