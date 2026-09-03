export const xpRicoFaturaPattern =
  /^\s*(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.*?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+-?\d{1,3}(?:\.\d{3})*,\d{2})?\s*$/;

export const xpRicoExtratoPattern =
  /^\s*(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.*?)\s+(-?R\$\s*\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+-?R\$\s*\d{1,3}(?:\.\d{3})*,\d{2})?\s*$/;
