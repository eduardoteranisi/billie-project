export const santanderPattern =
  /(\d{2}\/\d{2})\s+(.*?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)/g;

export const santanderGarbageWords = [
  "pagamento", "saldo", "total", "fatura", "iof", "juros",
  "multa", "encargo", "tarifa", "saque", "nacional", "internacional",
  "desconto", "estorno", "cancelamento", "credito", "crédito",
  "anterior", "atualizacao", "taxa", "bx", "financiamento",
  "pagando", "exato", "valor", "parcelamento",
];
