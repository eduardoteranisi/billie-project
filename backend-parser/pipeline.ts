import { routeInvoice } from "./services/bank_router";
import type { LogFn, ParseInvoiceInput, Transaction } from "./types";

export interface RunPipelineOptions extends ParseInvoiceInput {
  onLog: LogFn;
}

export interface PipelineResult {
  success: boolean;
  transactions?: Transaction[];
  error?: string;
}

export async function runPipeline(options: RunPipelineOptions): Promise<PipelineResult> {
  const { pdfBytes, password, bank, year, onLog } = options;

  try {
    onLog(`Iniciando pipeline para o banco: ${bank}`);

    onLog("Desbloqueando e lendo o PDF...");
    let transactions = await routeInvoice({ pdfBytes, password, bank, year });

    onLog(`✅ Extração concluída: ${transactions.length} transações encontradas.`);

    onLog("🎉 Extração finalizada com sucesso!");
    return { success: true, transactions };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onLog(`❌ Erro crítico: ${message}`);
    return { success: false, error: message };
  }
}