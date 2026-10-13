import type { Transaction } from "../types";
import { normalizeText } from "./text_utils";

const BILL_PAYMENT_WORD_PATTERN = /\b(PAGAMENTO|PAGTO|PGTO|PAG|DEBITO|DEB)\b/;
const CARD_PAYMENT_WORD_PATTERN = /\b(PAGAMENTO|PAGTO|PGTO|PAG)\b/;
const FATURA_WORD_PATTERN = /\bFATURA\b/;
const CARTAO_WORD_PATTERN = /\bCARTAO\b/;
const CARD_ISSUER_BOLETO_PATTERN = /\bBOLETO\b.*\b(BANCO XP|XP INVESTIMENTOS|RICO|NU PAGAMENTOS|NUBANK)\b/;

export function removeCardBillPaymentList(transactions: Transaction[]): Transaction[] {
  return transactions.filter((transaction) => !isCardBillPaymentDescription(transaction.description));
}

export function isCardBillPaymentDescription(description: string): boolean {
  const normalized = normalizeText(description);

  if (FATURA_WORD_PATTERN.test(normalized) && BILL_PAYMENT_WORD_PATTERN.test(normalized)) return true;
  if (CARTAO_WORD_PATTERN.test(normalized) && CARD_PAYMENT_WORD_PATTERN.test(normalized)) return true;
  return CARD_ISSUER_BOLETO_PATTERN.test(normalized);
}
