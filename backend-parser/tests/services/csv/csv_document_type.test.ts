import { describe, expect, it } from "vitest";
import { detectCsvDocumentType, isNoiseRow } from "../../../services/csv/csv_document_type";

describe("detectCsvDocumentType", () => {
  it("identifica extrato quando há alguma operação bancária", () => {
    expect(detectCsvDocumentType(["Padaria", "Pix enviado - João"])).toBe("extrato");
    expect(detectCsvDocumentType(["Transferência recebida"])).toBe("extrato");
  });

  it("identifica fatura quando só há compras", () => {
    expect(detectCsvDocumentType(["Padaria", "Uber", "Netflix"])).toBe("fatura");
  });

  it("só reconhece a palavra inteira", () => {
    expect(detectCsvDocumentType(["Loja PIXEL", "DOCERIA"])).toBe("fatura");
  });
});

describe("isNoiseRow", () => {
  it("marca pagamentos e estornos", () => {
    expect(isNoiseRow("Pagamento recebido")).toBe(true);
    expect(isNoiseRow("Estorno de compra")).toBe(true);
  });

  it("não marca compras comuns", () => {
    expect(isNoiseRow("Padaria")).toBe(false);
  });
});
