import { describe, expect, it } from "vitest";
import { formatFileSize, isCsv, isPdf } from "../../utils/file_helpers";

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

describe("isCsv", () => {
  it("reconhece o CSV pelo tipo MIME", () => {
    expect(isCsv(new File([], "extrato", { type: "text/csv" }))).toBe(true);
  });

  it("reconhece o CSV pela extensão quando não há tipo MIME", () => {
    expect(isCsv(new File([], "EXTRATO.CSV"))).toBe(true);
  });

  it("não considera CSV um arquivo PDF", () => {
    expect(isCsv(new File([], "fatura.pdf", { type: "application/pdf" }))).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("mostra bytes abaixo de 1 KB", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("arredonda os kilobytes para inteiro", () => {
    expect(formatFileSize(186_880)).toBe("183 KB");
  });

  it("mostra megabytes com uma casa decimal no padrão brasileiro", () => {
    expect(formatFileSize(1.25 * 1024 * 1024)).toBe("1,3 MB");
  });
});
