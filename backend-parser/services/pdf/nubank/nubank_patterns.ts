export const nubankPattern =
  /^\s*(\d{1,2}\s+[A-Za-z]{3})\s+(.*?)\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

export const monthAbbreviations: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04",
  MAI: "05", JUN: "06", JUL: "07", AGO: "08",
  SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};
