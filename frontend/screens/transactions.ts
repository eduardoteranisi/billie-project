import type { Bank, CsvColumnConfig } from "@billie/parser";
import {
  AUTOMATIC_YEAR,
  parseCsvStatementText,
  parsePdfStatementFile,
  saveParsedStatementToExpenses,
  type ParsedStatement,
} from "../services/statement_importer";
import type { StoredTransaction } from "../types";
import { fillColumnMappingSelects, readColumnMappingSelects } from "../components/column_mapping_form";
import { getRequiredElementById } from "../utils/dom_helpers";
import { isPdf } from "../utils/file_helpers";

type StatusReporter = (message: string, type?: "info" | "success" | "error") => void;

type ImportStep = "select" | "confirm" | "pdfDetails" | "status" | "mapping";

export function initTransactionsView(): void {
  const els = {
    btnImportStatement: getRequiredElementById<HTMLButtonElement>("btn-import-extrato"),
    importPopover: getRequiredElementById<HTMLDivElement>("import-popover"),
    importStepSelect: getRequiredElementById<HTMLDivElement>("import-step-select"),
    importStepConfirm: getRequiredElementById<HTMLDivElement>("import-step-confirm"),
    importStepStatus: getRequiredElementById<HTMLDivElement>("import-step-status"),
    importStepMapping: getRequiredElementById<HTMLDivElement>("import-step-mapping"),
    btnSelectFile: getRequiredElementById<HTMLButtonElement>("btn-selecionar-arquivo"),
    importFileInput: getRequiredElementById<HTMLInputElement>("import-file-input"),
    importConfirmText: getRequiredElementById<HTMLParagraphElement>("import-confirm-text"),
    importCsvBank: getRequiredElementById<HTMLSelectElement>("import-banco-csv"),
    btnConfirmImport: getRequiredElementById<HTMLButtonElement>("btn-confirmar-importacao"),
    btnCancelImport: getRequiredElementById<HTMLButtonElement>("btn-cancelar-importacao"),
    importStepPdfDetails: getRequiredElementById<HTMLDivElement>("import-step-pdf-details"),
    importPdfBank: getRequiredElementById<HTMLSelectElement>("import-banco"),
    btnConfirmPdfImport: getRequiredElementById<HTMLButtonElement>("btn-confirmar-importacao-pdf"),
    btnCancelPdfImport: getRequiredElementById<HTMLButtonElement>("btn-cancelar-importacao-pdf"),
    importStatus: getRequiredElementById<HTMLParagraphElement>("import-status"),
    btnCloseImport: getRequiredElementById<HTMLButtonElement>("btn-fechar-importacao"),

    btnConfirmMapping: getRequiredElementById<HTMLButtonElement>("btn-confirmar-mapeamento"),
    mappingStatus: getRequiredElementById<HTMLParagraphElement>("mapping-status"),
  };

  const mappingSelects = {
    date: getRequiredElementById<HTMLSelectElement>("map-col-data"),
    merchant: getRequiredElementById<HTMLSelectElement>("map-col-estabelecimento"),
    amount: getRequiredElementById<HTMLSelectElement>("map-col-valor"),
    installment: getRequiredElementById<HTMLSelectElement>("map-col-parcela"),
  };

  let importedCsvText: string | null = null;
  let csvFileToImport: File | null = null;
  let pdfFileToImport: File | null = null;

  const setImportStatus: StatusReporter = (message, type = "info") => {
    els.importStatus.textContent = message;
    els.importStatus.className = `import-status ${type}`;
    els.btnCloseImport.hidden = type === "info";
  };

  const setMappingStatus: StatusReporter = (message, type = "info") => {
    els.mappingStatus.textContent = message;
    els.mappingStatus.className = `import-status ${type}`;
    els.mappingStatus.hidden = false;
  };

  bindEvents();

  function showImportStep(step: ImportStep) {
    els.importStepSelect.hidden = step !== "select";
    els.importStepConfirm.hidden = step !== "confirm";
    els.importStepPdfDetails.hidden = step !== "pdfDetails";
    els.importStepStatus.hidden = step !== "status";
    els.importStepMapping.hidden = step !== "mapping";
  }

  function resetImportFlow() {
    csvFileToImport = null;
    pdfFileToImport = null;
    importedCsvText = null;
    els.mappingStatus.hidden = true;
    showImportStep("select");
  }

  function closeImportPopover() {
    els.importPopover.hidden = true;
  }

  function toggleImportPopover(event: MouseEvent) {
    event.stopPropagation();
    const willOpen = els.importPopover.hidden;
    els.importPopover.hidden = !els.importPopover.hidden;
    if (willOpen) resetImportFlow();
  }

  function onClickOutsideImportPopover(event: MouseEvent) {
    if (els.importPopover.hidden) return;
    const target = event.target as Node;
    if (els.importPopover.contains(target) || els.btnImportStatement.contains(target)) return;
    closeImportPopover();
  }

  function onImportFileInputChange() {
    const file = els.importFileInput.files?.[0];
    els.importFileInput.value = "";
    if (!file) return;

    if (isPdf(file)) {
      pdfFileToImport = file;
      showImportStep("pdfDetails");
      return;
    }

    csvFileToImport = file;
    els.importConfirmText.textContent = `Importar o arquivo "${file.name}"?`;
    showImportStep("confirm");
  }

  function onCancelImportClick() {
    csvFileToImport = null;
    showImportStep("select");
  }

  function onCancelPdfImportClick() {
    pdfFileToImport = null;
    showImportStep("select");
  }

  async function onConfirmPdfImportClick() {
    if (!pdfFileToImport) return;
    const file = pdfFileToImport;
    pdfFileToImport = null;

    const bank = els.importPdfBank.value as Bank;

    showImportStep("status");
    setImportStatus("Importando extrato...");

    try {
      await importPdfFile(file, bank, setImportStatus);
    } catch (error) {
      setImportStatus(`Erro ao importar extrato: ${error}`, "error");
    }
  }

  async function onConfirmImportClick() {
    if (!csvFileToImport) return;
    const file = csvFileToImport;
    csvFileToImport = null;
    const bank = els.importCsvBank.value as Bank;

    showImportStep("status");
    setImportStatus("Importando extrato...");

    try {
      importedCsvText = await file.text();
      await importCsvText(importedCsvText, undefined, bank, setImportStatus);
    } catch (error) {
      setImportStatus(`Erro ao importar extrato: ${error}`, "error");
    }
  }

  async function importPdfFile(file: File, bank: Bank, report: StatusReporter) {
    const statement = await parsePdfStatementFile(file, { bank, year: AUTOMATIC_YEAR });
    await saveStatementAndReport(statement, "pdf", report);
  }

  async function importCsvText(
    csvText: string,
    columns: CsvColumnConfig | undefined,
    bank: Bank,
    report: StatusReporter
  ) {
    const result = await parseCsvStatementText(csvText, { bank, columns });

    if (result.status === "needsColumnMapping") {
      showManualColumnMapping(result.headers);
      return;
    }

    await saveStatementAndReport(result.statement, "csv", report);
  }

  async function saveStatementAndReport(
    statement: ParsedStatement,
    origin: StoredTransaction["origin"],
    report: StatusReporter
  ) {
    const { added, duplicates } = await saveParsedStatementToExpenses(statement, origin);
    report(`${added} registros importados${duplicates > 0 ? ` (${duplicates} já existiam)` : ""}.`, "success");
  }

  function showManualColumnMapping(headers: string[]) {
    fillColumnMappingSelects(mappingSelects, headers);
    els.mappingStatus.hidden = true;
    showImportStep("mapping");
  }

  async function onConfirmMappingClick() {
    if (!importedCsvText) return;

    const columns = readColumnMappingSelects(mappingSelects);
    const bank = els.importCsvBank.value as Bank;

    els.btnConfirmMapping.disabled = true;
    setMappingStatus("Importando extrato...");
    try {
      await importCsvText(importedCsvText, columns, bank, setMappingStatus);
    } catch (error) {
      setMappingStatus(`Erro ao importar extrato: ${error}`, "error");
    } finally {
      els.btnConfirmMapping.disabled = false;
    }
  }

  function bindEvents() {
    els.btnImportStatement.addEventListener("click", toggleImportPopover);
    els.btnSelectFile.addEventListener("click", () => els.importFileInput.click());
    els.importFileInput.addEventListener("change", onImportFileInputChange);
    els.btnConfirmImport.addEventListener("click", onConfirmImportClick);
    els.btnCancelImport.addEventListener("click", onCancelImportClick);
    els.btnConfirmPdfImport.addEventListener("click", onConfirmPdfImportClick);
    els.btnCancelPdfImport.addEventListener("click", onCancelPdfImportClick);
    els.btnCloseImport.addEventListener("click", closeImportPopover);
    els.btnConfirmMapping.addEventListener("click", onConfirmMappingClick);
    document.addEventListener("click", onClickOutsideImportPopover);
  }
}
