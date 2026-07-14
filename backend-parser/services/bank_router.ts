import type { PdfParseInput, Transaction } from "../types";
import { extractNubank, extractXpRico, extractSantander } from "./pdf_reader";

export async function routeInvoice(input: PdfParseInput): Promise<Transaction[]> {
  const { pdfBytes, password, bank, year } = input;

  console.log(`Iniciando roteamento manual para o banco: ${bank}`);

  const normalizedBank = bank.toLowerCase().trim();

  switch (normalizedBank) {
    case "nubank":
      return await extractNubank(pdfBytes, year, password);

    case "xp / rico":
      return await extractXpRico(pdfBytes, year, password);

    case "santander":
      return await extractSantander(pdfBytes, year, password);

    default:
      throw new Error(`O extrator para o banco '${bank}' ainda não foi implementado.`);
  }
}
