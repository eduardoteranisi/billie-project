import { routeInvoice } from "./services/pdf/bank_router";
import { parseCsvInvoice } from "./services/csv/csv_reader";
import { CsvColumnMappingError } from "./services/csv/csv_column_mapping_error";
import type { CsvColumnRole } from "./services/csv/csv_column_resolver";
import type { LogFn, PdfParseInput, CsvParseInput, Transaction } from "./types";

export type RunPipelineOptions =
  | (PdfParseInput & { onLog: LogFn })
  | (CsvParseInput & { onLog: LogFn });

export interface PipelineResult {
  success: boolean;
  transactions?: Transaction[];
  error?: string;
  needsColumnMapping?: { headers: string[]; missingRoles: CsvColumnRole[] };
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
    if (error instanceof CsvColumnMappingError) {
      onLog("⚠️ Não foi possível identificar as colunas automaticamente.");
      return {
        success: false,
        error: error.message,
        needsColumnMapping: { headers: error.headers, missingRoles: error.missingRoles },
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    onLog(`❌ Erro crítico: ${message}`);
    return { success: false, error: message };
  }
}
