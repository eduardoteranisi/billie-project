// Script manual de verificação — não faz parte do pacote publicado.
// Rode com: node backend-parser/test-data/verify_csv_average.ts <arquivo.csv>
import { readFileSync } from "node:fs";

const [, , filePath] = process.argv;
if (!filePath) {
  console.error("Uso: node verify_csv_average.ts <arquivo.csv>");
  process.exit(1);
}

const text = readFileSync(filePath, "utf-8").replace(/^﻿/, "");
const [, ...rowLines] = text.trim().split("\n");
const rows = rowLines.map((line) => {
  const [date, merchant, amountRaw] = line.split(";");
  const amount = Number(amountRaw.replace(",", "."));
  return { date, merchant, amount };
});

const totalSpend = rows.reduce((sum, r) => sum + r.amount, 0);
const uniqueDays = new Set(rows.map((r) => r.date)).size;
console.log(`Linhas lidas: ${rows.length}`);
console.log(`Dias distintos: ${uniqueDays}`);
console.log(`Gasto médio por dia: ${(totalSpend / uniqueDays).toFixed(2)}`);
