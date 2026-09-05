export const santanderPattern =
  /(\d{2}\/\d{2})\s+(.*?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)/g;

export const santanderGarbageWords = [
  "pagamento", "saldo", "total", "fatura", "iof", "juros",
  "multa", "encargo", "tarifa", "saque", "nacional", "internacional",
  "desconto", "estorno", "cancelamento", "credito", "crédito",
  "anterior", "atualizacao", "taxa", "bx", "financiamento",
  "pagando", "exato", "valor", "parcelamento",
];

export const santanderExtratoDocumentMarkerPattern = /extrato\s+consolidado\s+inteligente/i;

export const santanderExtratoSectionStartPattern = /movimenta[çc][ãa]o/i;

export const santanderExtratoSectionStopPattern = /saldos\s+por\s+per[íi]odo/i;

export const santanderExtratoPageBreakPattern = /p\s*agina:\s*\d+\s*\/\s*\d+/i;

export const santanderExtratoTransactionPattern =
  /^(?:(\d{2}\/\d{2})\s+)?(.+?)\s+(?:-|\d+)\s+(\d{1,3}(?:\.\d{3})*,\d{2})(-)?(?:\s+\d{1,3}(?:\.\d{3})*,\d{2})?\s*$/;
