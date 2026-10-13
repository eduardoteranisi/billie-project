import { exportToCsv, DEFAULT_CSV_COLUMNS, type Bank, type CsvColumnConfig, type Transaction } from "@billie/parser";
import {
  AUTOMATIC_YEAR,
  parseCsvStatementText,
  parsePdfStatementFile,
  saveParsedStatementToFinanceStore,
  type ParsedStatement,
} from "../services/statement_importer";
import { convertSavedCsvColumnsToCurrent } from "../services/legacy_data_conversion";
import type { StoredExpense } from "../types";
import { fillColumnMappingSelects, readColumnMappingSelects } from "../components/column_mapping_form";
import { escapeHtmlSpecialCharacters, getRequiredElementById } from "../utils/dom_helpers";
import { downloadTextFile, isPdf } from "../utils/file_helpers";

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<any>;

declare global {
  interface Window {
    __TAURI__?: { invoke: InvokeFn };
  }
}

const CSV_COLUMNS_STORAGE_KEY = "billie:csv-colunas";
const OLDEST_SELECTABLE_YEAR = 2021;

export function log(message: string, type: "info" | "error" | "success" = "info") {
  const logEl = getRequiredElementById<HTMLDivElement>("log");
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const entry = document.createElement("span");
  entry.className = `entry ${type}`;

  const timestampEl = document.createElement("span");
  timestampEl.className = "ts";
  timestampEl.textContent = time;

  entry.appendChild(timestampEl);
  entry.appendChild(document.createTextNode(message));

  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

export function initInvoiceView(): void {
  const els = {
    fileRow: getRequiredElementById<HTMLButtonElement>("file-row"),
    fileName: getRequiredElementById<HTMLSpanElement>("file-name"),
    fileInput: getRequiredElementById<HTMLInputElement>("file-input"),

    password: getRequiredElementById<HTMLInputElement>("senha"),
    bank: getRequiredElementById<HTMLSelectElement>("banco"),
    year: getRequiredElementById<HTMLSelectElement>("ano"),

    colDate: getRequiredElementById<HTMLInputElement>("col-data"),
    colDescription: getRequiredElementById<HTMLInputElement>("col-estabelecimento"),
    colAmount: getRequiredElementById<HTMLInputElement>("col-valor"),
    btnRestoreColumns: getRequiredElementById<HTMLButtonElement>("btn-restaurar-colunas"),

    btnProcess: getRequiredElementById<HTMLButtonElement>("btn-processar"),

    modalSaveToFinanceStore: getRequiredElementById<HTMLDivElement>("modal-save-to-finance-store"),
    modalSaveToFinanceStoreConfirm: getRequiredElementById<HTMLButtonElement>("modal-save-to-finance-store-confirm"),
    modalSaveToFinanceStoreSkip: getRequiredElementById<HTMLButtonElement>("modal-save-to-finance-store-skip"),

    modalCsvColumns: getRequiredElementById<HTMLDivElement>("modal-csv-columns"),
    modalCsvColumnsConfirm: getRequiredElementById<HTMLButtonElement>("modal-csv-columns-confirm"),
    modalCsvColumnsCancel: getRequiredElementById<HTMLButtonElement>("modal-csv-columns-cancel"),

    sectionInvoiceMapping: getRequiredElementById<HTMLDivElement>("section-invoice-mapping"),
    btnConfirmMapping: getRequiredElementById<HTMLButtonElement>("btn-confirmar-mapeamento-fatura"),
  };

  const mappingSelects = {
    date: getRequiredElementById<HTMLSelectElement>("invoice-map-col-data"),
    description: getRequiredElementById<HTMLSelectElement>("invoice-map-col-estabelecimento"),
    amount: getRequiredElementById<HTMLSelectElement>("invoice-map-col-valor"),
    installment: getRequiredElementById<HTMLSelectElement>("invoice-map-col-parcela"),
  };

  let selectedFilePath: string | null = null;
  let selectedFile: File | null = null;
  let pendingCsvText: string | null = null;

  fillYearOptions(els.year);
  loadCsvColumnsConfig();
  bindEvents();

  function fillYearOptions(select: HTMLSelectElement) {
    const currentYear = new Date().getFullYear();
    const options = [AUTOMATIC_YEAR];
    for (let year = currentYear; year >= OLDEST_SELECTABLE_YEAR; year--) options.push(String(year));

    select.innerHTML = options
      .map((option) => `<option value="${escapeHtmlSpecialCharacters(option)}">${escapeHtmlSpecialCharacters(option)}</option>`)
      .join("");
  }

  function selectFile() {
    if (window.__TAURI__) {
      selectFileWithTauri();
    } else {
      els.fileInput.click();
    }
  }

  async function selectFileWithTauri() {
    const result = await window.__TAURI__!.invoke("selecionar_arquivo");
    if (!result?.caminho) return;

    selectedFilePath = result.caminho;
    selectedFile = null;
    registerSelectedFile(result.caminho.split("/").pop());
  }

  function onFileInputChange() {
    const file = els.fileInput.files?.[0];
    if (!file) return;

    selectedFile = file;
    selectedFilePath = null;
    registerSelectedFile(file.name);
  }

  function registerSelectedFile(name: string) {
    els.fileName.textContent = name;
    els.fileRow.classList.remove("empty");
    log(`Arquivo selecionado: ${name}`);
  }

  function hasSelectedFile(): boolean {
    return selectedFilePath !== null || selectedFile !== null;
  }

  function loadCsvColumnsConfig() {
    let config: CsvColumnConfig = DEFAULT_CSV_COLUMNS;

    const saved = localStorage.getItem(CSV_COLUMNS_STORAGE_KEY);
    if (saved) {
      try {
        config = convertSavedCsvColumnsToCurrent(JSON.parse(saved), DEFAULT_CSV_COLUMNS);
      } catch {
        config = DEFAULT_CSV_COLUMNS;
      }
    }

    els.colDate.value = config.date;
    els.colDescription.value = config.description;
    els.colAmount.value = config.amount;
  }

  function saveCsvColumnsConfig() {
    localStorage.setItem(CSV_COLUMNS_STORAGE_KEY, JSON.stringify(readCsvColumnsConfig()));
  }

  function readCsvColumnsConfig(): CsvColumnConfig {
    return {
      date: els.colDate.value.trim() || DEFAULT_CSV_COLUMNS.date,
      description: els.colDescription.value.trim() || DEFAULT_CSV_COLUMNS.description,
      amount: els.colAmount.value.trim() || DEFAULT_CSV_COLUMNS.amount,
    };
  }

  function restoreDefaultCsvColumns() {
    els.colDate.value = DEFAULT_CSV_COLUMNS.date;
    els.colDescription.value = DEFAULT_CSV_COLUMNS.description;
    els.colAmount.value = DEFAULT_CSV_COLUMNS.amount;
    saveCsvColumnsConfig();
  }

  function confirmSaveToFinanceStore(): Promise<boolean> {
    return new Promise((resolve) => {
      const finish = (result: boolean) => {
        els.modalSaveToFinanceStore.hidden = true;
        els.modalSaveToFinanceStoreConfirm.removeEventListener("click", onConfirm);
        els.modalSaveToFinanceStoreSkip.removeEventListener("click", onSkip);
        resolve(result);
      };
      const onConfirm = () => finish(true);
      const onSkip = () => finish(false);

      els.modalSaveToFinanceStoreConfirm.addEventListener("click", onConfirm);
      els.modalSaveToFinanceStoreSkip.addEventListener("click", onSkip);
      els.modalSaveToFinanceStore.hidden = false;
    });
  }

  function askCsvColumnNames(): Promise<CsvColumnConfig | null> {
    return new Promise((resolve) => {
      const finish = (config: CsvColumnConfig | null) => {
        els.modalCsvColumns.hidden = true;
        els.modalCsvColumnsConfirm.removeEventListener("click", onConfirm);
        els.modalCsvColumnsCancel.removeEventListener("click", onCancel);
        resolve(config);
      };
      const onConfirm = () => finish(readCsvColumnsConfig());
      const onCancel = () => finish(null);

      els.modalCsvColumnsConfirm.addEventListener("click", onConfirm);
      els.modalCsvColumnsCancel.addEventListener("click", onCancel);
      els.modalCsvColumns.hidden = false;
    });
  }

  async function processInvoice() {
    if (!hasSelectedFile()) {
      log("Nenhum arquivo selecionado.", "error");
      return;
    }

    els.btnProcess.disabled = true;
    els.btnProcess.textContent = "Processando...";
    els.sectionInvoiceMapping.hidden = true;
    log("Processando fatura...");

    try {
      if (!selectedFile) {
        throw new Error("Seleção de arquivo pelo Tauri ainda não implementada.");
      }

      if (isPdf(selectedFile)) {
        await processPdfFile(selectedFile);
      } else {
        pendingCsvText = await selectedFile.text();
        await processCsvText(pendingCsvText, undefined);
      }
    } catch (error) {
      log(`Erro ao processar: ${error}`, "error");
      els.btnProcess.textContent = "Tentar novamente";
    } finally {
      els.btnProcess.disabled = false;
    }
  }

  async function processPdfFile(file: File) {
    const statement = await parsePdfStatementFile(file, {
      bank: els.bank.value as Bank,
      year: els.year.value,
      password: els.password.value || undefined,
      onLog: (message) => log(message),
    });

    const shouldSaveToFinanceStore = await confirmSaveToFinanceStore();
    if (shouldSaveToFinanceStore) {
      await saveStatementAndLog(statement, "pdf");
    } else {
      const config = await askCsvColumnNames();
      if (config) {
        const allTransactions = [...statement.expenses, ...statement.income];
        const fileName = buildCsvFileName(els.bank.value, findInvoicePeriod(allTransactions));
        downloadTextFile(exportToCsv(allTransactions, config), fileName, "text/csv;charset=utf-8");
        log(`Arquivo "${fileName}" salvo na pasta Downloads.`, "success");
      } else {
        log("Geração de CSV cancelada.");
      }
    }

    els.btnProcess.textContent = "Processar outra fatura";
  }

  async function processCsvText(csvText: string, columns: CsvColumnConfig | undefined) {
    const result = await parseCsvStatementText(csvText, {
      bank: els.bank.value as Bank,
      columns,
      onLog: (message) => log(message),
    });

    if (result.status === "needsColumnMapping") {
      showManualColumnMapping(result.headers);
      return;
    }

    els.sectionInvoiceMapping.hidden = true;
    await saveStatementAndLog(result.statement, "csv");
    log("Salvo no Controle de Gastos.", "success");
    els.btnProcess.textContent = "Processar outra fatura";
  }

  function showManualColumnMapping(headers: string[]) {
    fillColumnMappingSelects(mappingSelects, headers);
    els.sectionInvoiceMapping.hidden = false;
    log("⚠️ Não foi possível identificar as colunas automaticamente.", "error");
  }

  async function onConfirmMappingClick() {
    if (!pendingCsvText) return;

    els.btnConfirmMapping.disabled = true;
    try {
      await processCsvText(pendingCsvText, readColumnMappingSelects(mappingSelects));
    } catch (error) {
      log(`Erro ao processar: ${error}`, "error");
    } finally {
      els.btnConfirmMapping.disabled = false;
    }
  }

  async function saveStatementAndLog(statement: ParsedStatement, origin: StoredExpense["origin"]) {
    const { added, duplicates } = await saveParsedStatementToFinanceStore(statement, origin);
    log(
      `${added} transações novas salvas no controle de gastos${duplicates > 0 ? ` (${duplicates} já existiam)` : ""}.`,
      "success"
    );
  }

  function buildCsvFileName(bank: string, period: string): string {
    const bankSlug = bank
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `fatura-${bankSlug}-${period}.csv`;
  }

  function findInvoicePeriod(transactions: Transaction[]): string {
    if (transactions.length === 0) return new Date().toISOString().slice(0, 7);
    const periods = transactions.map((transaction) => transaction.date.slice(0, 7)); // "YYYY-MM" direto da string ISO
    return findMostFrequentValue(periods);
  }

  function findMostFrequentValue(values: string[]): string {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }


  function bindEvents() {
    els.fileRow.addEventListener("click", selectFile);
    els.fileInput.addEventListener("change", onFileInputChange);
    els.btnProcess.addEventListener("click", processInvoice);

    els.colDate.addEventListener("blur", saveCsvColumnsConfig);
    els.colDescription.addEventListener("blur", saveCsvColumnsConfig);
    els.colAmount.addEventListener("blur", saveCsvColumnsConfig);
    els.btnRestoreColumns.addEventListener("click", restoreDefaultCsvColumns);

    els.btnConfirmMapping.addEventListener("click", onConfirmMappingClick);
  }
}
