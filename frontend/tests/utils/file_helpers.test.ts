import { describe, expect, it } from "vitest";
import { isPdf } from "../../utils/file_helpers";

describe("isPdf", () => {
  it("reconhece o PDF pelo tipo MIME", () => {
    expect(isPdf(new File([], "fatura", { type: "application/pdf" }))).toBe(true);
  });

  it("reconhece o PDF pela extensão quando não há tipo MIME", () => {
    expect(isPdf(new File([], "FATURA.PDF"))).toBe(true);
  });

  it("não considera PDF um arquivo CSV", () => {
    expect(isPdf(new File([], "extrato.csv", { type: "text/csv" }))).toBe(false);
  });
});
