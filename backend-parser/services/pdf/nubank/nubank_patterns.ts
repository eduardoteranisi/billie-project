export const nubankFaturaPattern =
  /^\s*(\d{1,2}\s+[A-Za-z]{3})\s+(.*?)\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

export const nubankExtratoDayHeaderPattern =
  /^\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+Total de (entradas|saídas)\b/i;

export const nubankExtratoGroupHeaderPattern = /^\s*Total de (entradas|saídas)\b/i;

export const nubankExtratoAmountAtEndPattern =
  /^(.*\S)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

export const nubankExtratoStopPattern =
  /saldo líquido corresponde ao total de dep[oó]sitos/i;

export const nubankExtratoFooterPattern = /^\s*Tem alguma dúvida\?/i;

export const nubankExtratoRendimentoPattern =
  /Rendimento líquido\s+[+-]?(\d{1,3}(?:\.\d{3})*,\d{2})/i;

export const nubankExtratoPeriodEndPattern =
  /\ba\s+(\d{1,2})\s+de\s+([A-Za-zÇç]+)\s+de\s+(\d{4})\b/i;

export const monthAbbreviations: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04",
  MAI: "05", JUN: "06", JUL: "07", AGO: "08",
  SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};
