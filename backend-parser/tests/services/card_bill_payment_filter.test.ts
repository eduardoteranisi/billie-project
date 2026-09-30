import { describe, expect, it } from "vitest";
import {
  isCardBillPaymentDescription,
  removeCardBillPaymentList,
} from "../../services/card_bill_payment_filter";

describe("isCardBillPaymentDescription", () => {
  it.each([
    "Pagamento de fatura",
    "PGTO FATURA NUBANK",
    "Débito automático fatura cartão",
    "PAGTO CARTAO CREDITO",
    "Pagamento cartão de crédito",
    "BOLETO PAGO NU PAGAMENTOS SA",
    "Boleto Banco XP",
  ])("reconhece pagamento de fatura: %s", (description) => {
    expect(isCardBillPaymentDescription(description)).toBe(true);
  });

  it.each([
    "DEBITO CARTAO PADARIA",
    "Compra no débito",
    "Mercado Livre",
    "Pix enviado João",
    "BOLETO CONDOMINIO",
    "Fatura de energia ENEL",
  ])("não confunde com gasto real: %s", (description) => {
    expect(isCardBillPaymentDescription(description)).toBe(false);
  });
});

describe("removeCardBillPaymentList", () => {
  it("remove só os pagamentos de fatura, mantendo a ordem", () => {
    const transactions = [
      { id: "1", date: "2026-03-01", merchant: "Mercado", amount: 100 },
      { id: "2", date: "2026-03-05", merchant: "Pagamento de fatura", amount: 900 },
      { id: "3", date: "2026-03-07", merchant: "Farmácia", amount: 30 },
    ];

    expect(removeCardBillPaymentList(transactions).map((t) => t.id)).toEqual(["1", "3"]);
  });
});
