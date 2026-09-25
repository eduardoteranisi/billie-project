import type { Transaction } from "../types";
import { normalizeText } from "./text_utils";

// pagar a fatura do cartão só move dinheiro da conta para o cartão: as compras reais já
// chegam pela própria fatura, então contar o pagamento também duplicaria o gasto.
const BILL_PAYMENT_WORD_PATTERN = /\b(PAGAMENTO|PAGTO|PGTO|PAG|DEBITO|DEB)\b/;
const CARD_PAYMENT_WORD_PATTERN = /\b(PAGAMENTO|PAGTO|PGTO|PAG)\b/;
const FATURA_WORD_PATTERN = /\bFATURA\b/;
const CARTAO_WORD_PATTERN = /\bCARTAO\b/;
const CARD_ISSUER_BOLETO_PATTERN = /\bBOLETO\b.*\b(BANCO XP|XP INVESTIMENTOS|RICO|NU PAGAMENTOS|NUBANK)\b/;

export function removeCardBillPaymentList(transactions: Transaction[]): Transaction[] {
  return transactions.filter((transaction) => !isCardBillPaymentDescription(transaction.merchant));
}

export function isCardBillPaymentDescription(description: string): boolean {
  const normalized = normalizeText(description);

  if (FATURA_WORD_PATTERN.test(normalized) && BILL_PAYMENT_WORD_PATTERN.test(normalized)) return true;
  // "DEBITO CARTAO" sozinho pode ser compra no débito, por isso cartão só conta junto de "pagamento".
  if (CARTAO_WORD_PATTERN.test(normalized) && CARD_PAYMENT_WORD_PATTERN.test(normalized)) return true;
  return CARD_ISSUER_BOLETO_PATTERN.test(normalized);
}
