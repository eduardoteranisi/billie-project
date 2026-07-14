import { routeInvoice } from "./services/bank_router";
import { parseCsvInvoice } from "./services/csv_reader";
import type { LogFn, PdfParseInput, CsvParseInput, Transaction } from "./types";

export type RunPipelineOptions =
  | (PdfParseInput & { onLog: LogFn })
  | (CsvParseInput & { onLog: LogFn });

export interface PipelineResult {
  success: boolean;
  transactions?: Transaction[];
  error?: string;
}

export async function runPipeline(options: RunPipelineOptions): Promise<PipelineResult> {
  const { onLog } = options;

  try {
    let transactions: Transaction[];

    if (options.source === "pdf") {
      const { pdfBytes, password, bank, year } = options;
      onLog(`Iniciando pipeline para o banco: ${bank}`);
      onLog("Desbloqueando e lendo o PDF...");
      transactions = await routeInvoice({ source: "pdf", pdfBytes, password, bank, year });
    } else {
      onLog("Iniciando pipeline para importação de CSV...");
      transactions = await parseCsvInvoice(options.csvText, options.columns);
    }

    onLog(`✅ Extração concluída: ${transactions.length} transações encontradas.`);
    onLog("🎉 Extração finalizada com sucesso!");
    return { success: true, transactions };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onLog(`❌ Erro crítico: ${message}`);
    return { success: false, error: message };
  }
}
