import { runPipeline, type Bank, type CsvColumnConfig } from "@billie/parser";
import {
  classificarESalvarTransacoes,
  salvarIncomeNoControle,
  somarResultadosSalvamento,
} from "../services/transaction_saver";
import { EXPENSES_UPDATED_EVENT } from "./expenses";
import { ANO_AUTOMATICO } from "./invoice";
import { getRequiredElementById } from "../utils/dom_helpers";

type StatusReporter = (mensagem: string, tipo?: "info" | "success" | "error") => void;

type EtapaImportacao = "select" | "confirm" | "pdfDetails" | "status" | "mapping";

export function initTransactionsView(): void {
  const els = {
    btnImportExtrato: getRequiredElementById<HTMLButtonElement>("btn-import-extrato"),
    importPopover: getRequiredElementById<HTMLDivElement>("import-popover"),
    importStepSelect: getRequiredElementById<HTMLDivElement>("import-step-select"),
    importStepConfirm: getRequiredElementById<HTMLDivElement>("import-step-confirm"),
    importStepStatus: getRequiredElementById<HTMLDivElement>("import-step-status"),
    importStepMapping: getRequiredElementById<HTMLDivElement>("import-step-mapping"),
    btnSelecionarArquivo: getRequiredElementById<HTMLButtonElement>("btn-selecionar-arquivo"),
    importFileInput: getRequiredElementById<HTMLInputElement>("import-file-input"),
    importConfirmText: getRequiredElementById<HTMLParagraphElement>("import-confirm-text"),
    importBancoCsv: getRequiredElementById<HTMLSelectElement>("import-banco-csv"),
    btnConfirmarImportacao: getRequiredElementById<HTMLButtonElement>("btn-confirmar-importacao"),
    btnCancelarImportacao: getRequiredElementById<HTMLButtonElement>("btn-cancelar-importacao"),
    importStepPdfDetails: getRequiredElementById<HTMLDivElement>("import-step-pdf-details"),
    importBanco: getRequiredElementById<HTMLSelectElement>("import-banco"),
    btnConfirmarImportacaoPdf: getRequiredElementById<HTMLButtonElement>("btn-confirmar-importacao-pdf"),
    btnCancelarImportacaoPdf: getRequiredElementById<HTMLButtonElement>("btn-cancelar-importacao-pdf"),
    importStatus: getRequiredElementById<HTMLParagraphElement>("import-status"),
    btnFecharImportacao: getRequiredElementById<HTMLButtonElement>("btn-fechar-importacao"),

    mapColData: getRequiredElementById<HTMLSelectElement>("map-col-data"),
    mapColEstabelecimento: getRequiredElementById<HTMLSelectElement>("map-col-estabelecimento"),
    mapColValor: getRequiredElementById<HTMLSelectElement>("map-col-valor"),
    mapColParcela: getRequiredElementById<HTMLSelectElement>("map-col-parcela"),
    btnConfirmarMapeamento: getRequiredElementById<HTMLButtonElement>("btn-confirmar-mapeamento"),
    mappingStatus: getRequiredElementById<HTMLParagraphElement>("mapping-status"),
  };

  let csvImportadoTexto: string | null = null;
  let arquivoParaImportar: File | null = null;
  let arquivoPdfParaImportar: File | null = null;

  function mostrarEtapaImportacao(etapa: EtapaImportacao) {
    els.importStepSelect.hidden = etapa !== "select";
    els.importStepConfirm.hidden = etapa !== "confirm";
    els.importStepPdfDetails.hidden = etapa !== "pdfDetails";
    els.importStepStatus.hidden = etapa !== "status";
    els.importStepMapping.hidden = etapa !== "mapping";
  }

  function resetarFluxoImportacao() {
    arquivoParaImportar = null;
    arquivoPdfParaImportar = null;
    csvImportadoTexto = null;
    els.mappingStatus.hidden = true;
    mostrarEtapaImportacao("select");
  }

  function fecharPopoverImportacao() {
    els.importPopover.hidden = true;
  }

  function alternarPopoverImportacao(evento: MouseEvent) {
    evento.stopPropagation();
    const vaiAbrir = els.importPopover.hidden;
    els.importPopover.hidden = !els.importPopover.hidden;
    if (vaiAbrir) resetarFluxoImportacao();
  }

  function onCliqueForaPopoverImportacao(evento: MouseEvent) {
    if (els.importPopover.hidden) return;
    const alvo = evento.target as Node;
    if (els.importPopover.contains(alvo) || els.btnImportExtrato.contains(alvo)) return;
    fecharPopoverImportacao();
  }

  const setImportStatus: StatusReporter = (mensagem, tipo = "info") => {
    els.importStatus.textContent = mensagem;
    els.importStatus.className = `import-status ${tipo}`;
    els.btnFecharImportacao.hidden = tipo === "info";
  };

  const setMappingStatus: StatusReporter = (mensagem, tipo = "info") => {
    els.mappingStatus.textContent = mensagem;
    els.mappingStatus.className = `import-status ${tipo}`;
    els.mappingStatus.hidden = false;
  };

  function arquivoEhPdf(arquivo: File): boolean {
    return arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
  }

  function onImportFileInputChange() {
    const arquivo = els.importFileInput.files?.[0];
    els.importFileInput.value = "";
    if (!arquivo) return;

    if (arquivoEhPdf(arquivo)) {
      arquivoPdfParaImportar = arquivo;
      mostrarEtapaImportacao("pdfDetails");
      return;
    }

    arquivoParaImportar = arquivo;
    els.importConfirmText.textContent = `Importar o arquivo "${arquivo.name}"?`;
    mostrarEtapaImportacao("confirm");
  }

  function onCancelarImportacaoClick() {
    arquivoParaImportar = null;
    mostrarEtapaImportacao("select");
  }

  function onCancelarImportacaoPdfClick() {
    arquivoPdfParaImportar = null;
    mostrarEtapaImportacao("select");
  }

  async function onConfirmarImportacaoPdfClick() {
    if (!arquivoPdfParaImportar) return;
    const arquivo = arquivoPdfParaImportar;
    arquivoPdfParaImportar = null;

    const bank = els.importBanco.value as Bank;

    mostrarEtapaImportacao("status");
    setImportStatus("Importando extrato...");

    try {
      await processarImportacaoPdf(arquivo, bank, setImportStatus);
    } catch (erro) {
      setImportStatus(`Erro ao importar extrato: ${erro}`, "error");
    }
  }

  async function onConfirmarImportacaoClick() {
    if (!arquivoParaImportar) return;
    const arquivo = arquivoParaImportar;
    arquivoParaImportar = null;
    const bank = els.importBancoCsv.value as Bank;

    mostrarEtapaImportacao("status");
    setImportStatus("Importando extrato...");

    try {
      csvImportadoTexto = await arquivo.text();
      await processarImportacaoCsv(csvImportadoTexto, undefined, bank, setImportStatus);
    } catch (erro) {
      setImportStatus(`Erro ao importar extrato: ${erro}`, "error");
    }
  }

  async function processarImportacaoPdf(arquivo: File, bank: Bank, reportar: StatusReporter) {
    const pdfBytes = new Uint8Array(await arquivo.arrayBuffer());

    const resultado = await runPipeline({
      source: "pdf",
      pdfBytes,
      bank,
      year: ANO_AUTOMATICO,
      onLog: () => {},
    });

    if (!resultado.success || !resultado.transactions) {
      throw new Error(resultado.error ?? "erro desconhecido no processamento");
    }

    const resultadoTransacoes = await classificarESalvarTransacoes(resultado.transactions, "pdf");
    const resultadoIncome = await salvarIncomeNoControle(resultado.income);
    const { added, duplicates } = somarResultadosSalvamento(resultadoTransacoes, resultadoIncome);

    document.dispatchEvent(new Event(EXPENSES_UPDATED_EVENT));
    reportar(
      `${added} registros importados${duplicates > 0 ? ` (${duplicates} já existiam)` : ""}.`,
      "success"
    );
  }

  async function processarImportacaoCsv(
    csvText: string,
    columns: CsvColumnConfig | undefined,
    bank: Bank,
    reportar: StatusReporter
  ) {
    const resultado = await runPipeline({
      source: "csv",
      csvText,
      columns,
      bank,
      onLog: () => {},
    });

    if (!resultado.success || !resultado.transactions) {
      if (resultado.needsColumnMapping) {
        mostrarMapeamentoManualImportacao(resultado.needsColumnMapping.headers);
        return;
      }
      throw new Error(resultado.error ?? "erro desconhecido no processamento");
    }

    const resultadoTransacoes = await classificarESalvarTransacoes(resultado.transactions, "csv");
    const resultadoIncome = await salvarIncomeNoControle(resultado.income);
    const { added, duplicates } = somarResultadosSalvamento(resultadoTransacoes, resultadoIncome);

    document.dispatchEvent(new Event(EXPENSES_UPDATED_EVENT));
    reportar(
      `${added} registros importados${duplicates > 0 ? ` (${duplicates} já existiam)` : ""}.`,
      "success"
    );
  }

  function escapeHtml(value: string): string {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return value.replace(/[&<>"']/g, (char) => entities[char]);
  }

  function mostrarMapeamentoManualImportacao(headers: string[]) {
    const options = headers
      .map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`)
      .join("");
    els.mapColData.innerHTML = options;
    els.mapColEstabelecimento.innerHTML = options;
    els.mapColValor.innerHTML = options;
    els.mapColParcela.innerHTML = `<option value="">— nenhuma —</option>${options}`;

    els.mappingStatus.hidden = true;
    mostrarEtapaImportacao("mapping");
  }

  async function onConfirmarMapeamentoImportacao() {
    if (!csvImportadoTexto) return;

    const columns: CsvColumnConfig = {
      date: els.mapColData.value,
      merchant: els.mapColEstabelecimento.value,
      amount: els.mapColValor.value,
      installment: els.mapColParcela.value || undefined,
    };
    const bank = els.importBancoCsv.value as Bank;

    els.btnConfirmarMapeamento.disabled = true;
    setMappingStatus("Importando extrato...");
    try {
      await processarImportacaoCsv(csvImportadoTexto, columns, bank, setMappingStatus);
    } catch (erro) {
      setMappingStatus(`Erro ao importar extrato: ${erro}`, "error");
    } finally {
      els.btnConfirmarMapeamento.disabled = false;
    }
  }

  function bindEvents() {
    els.btnImportExtrato.addEventListener("click", alternarPopoverImportacao);
    els.btnSelecionarArquivo.addEventListener("click", () => els.importFileInput.click());
    els.importFileInput.addEventListener("change", onImportFileInputChange);
    els.btnConfirmarImportacao.addEventListener("click", onConfirmarImportacaoClick);
    els.btnCancelarImportacao.addEventListener("click", onCancelarImportacaoClick);
    els.btnConfirmarImportacaoPdf.addEventListener("click", onConfirmarImportacaoPdfClick);
    els.btnCancelarImportacaoPdf.addEventListener("click", onCancelarImportacaoPdfClick);
    els.btnFecharImportacao.addEventListener("click", fecharPopoverImportacao);
    els.btnConfirmarMapeamento.addEventListener("click", onConfirmarMapeamentoImportacao);
    document.addEventListener("click", onCliqueForaPopoverImportacao);
  }

  bindEvents();
}
