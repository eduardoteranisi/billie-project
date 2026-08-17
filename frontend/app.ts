import {
  runPipeline,
  exportToCsv,
  classifyTransactionList,
  DEFAULT_CSV_COLUMNS,
  type Bank,
  type CsvColumnConfig,
  type Transaction,
} from "@billie/parser";
import { checkForUpdates, openExternalLink } from "./services/update_checker";
import { listCategoryRules, saveTransactions, saveIncomeEntries } from "./services/expense_store";
import { initExpensesView, EXPENSES_UPDATED_EVENT } from "./screens/expenses";
import type { ManualIncomeEntry, StoredTransaction } from "./types";

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<any>;

declare global {
  interface Window {
    __TAURI__?: { invoke: InvokeFn };
  }
}

// ---------- referências de DOM ----------

const els = {
  updateBanner: byId<HTMLDivElement>("update-banner"),
  updateText: byId<HTMLSpanElement>("update-text"),
  btnUpdate: byId<HTMLButtonElement>("btn-update"),
  btnTema: byId<HTMLButtonElement>("btn-tema"),
  btnCategories: byId<HTMLButtonElement>("btn-categories"),
  modalCategories: byId<HTMLDivElement>("modal-categories"),
  modalCategoriesClose: byId<HTMLButtonElement>("modal-categories-close"),

  tabInvoice: byId<HTMLButtonElement>("tab-invoice"),
  tabExpenses: byId<HTMLButtonElement>("tab-expenses"),
  tabTransactions: byId<HTMLButtonElement>("tab-transactions"),
  viewInvoice: byId<HTMLDivElement>("view-invoice"),
  viewExpenses: byId<HTMLDivElement>("view-expenses"),
  viewTransactions: byId<HTMLDivElement>("view-transactions"),

  fileRow: byId<HTMLButtonElement>("file-row"),
  fileName: byId<HTMLSpanElement>("file-name"),
  fileInput: byId<HTMLInputElement>("file-input"),

  senha: byId<HTMLInputElement>("senha"),
  banco: byId<HTMLSelectElement>("banco"),
  ano: byId<HTMLSelectElement>("ano"),

  colData: byId<HTMLInputElement>("col-data"),
  colEstabelecimento: byId<HTMLInputElement>("col-estabelecimento"),
  colValor: byId<HTMLInputElement>("col-valor"),
  btnRestaurarColunas: byId<HTMLButtonElement>("btn-restaurar-colunas"),

  btnProcessar: byId<HTMLButtonElement>("btn-processar"),
  log: byId<HTMLDivElement>("log"),

  modalSaveExpenses: byId<HTMLDivElement>("modal-save-expenses"),
  modalSaveExpensesConfirm: byId<HTMLButtonElement>("modal-save-expenses-confirm"),
  modalSaveExpensesSkip: byId<HTMLButtonElement>("modal-save-expenses-skip"),

  btnImportExtrato: byId<HTMLButtonElement>("btn-import-extrato"),
  importPopover: byId<HTMLDivElement>("import-popover"),
  importStepSelect: byId<HTMLDivElement>("import-step-select"),
  importStepConfirm: byId<HTMLDivElement>("import-step-confirm"),
  importStepStatus: byId<HTMLDivElement>("import-step-status"),
  importStepMapping: byId<HTMLDivElement>("import-step-mapping"),
  btnSelecionarCsv: byId<HTMLButtonElement>("btn-selecionar-csv"),
  importFileInput: byId<HTMLInputElement>("import-file-input"),
  importConfirmText: byId<HTMLParagraphElement>("import-confirm-text"),
  btnConfirmarImportacao: byId<HTMLButtonElement>("btn-confirmar-importacao"),
  btnCancelarImportacao: byId<HTMLButtonElement>("btn-cancelar-importacao"),
  importStatus: byId<HTMLParagraphElement>("import-status"),
  btnFecharImportacao: byId<HTMLButtonElement>("btn-fechar-importacao"),

  mapColData: byId<HTMLSelectElement>("map-col-data"),
  mapColEstabelecimento: byId<HTMLSelectElement>("map-col-estabelecimento"),
  mapColValor: byId<HTMLSelectElement>("map-col-valor"),
  mapColParcela: byId<HTMLSelectElement>("map-col-parcela"),
  btnConfirmarMapeamento: byId<HTMLButtonElement>("btn-confirmar-mapeamento"),
  mappingStatus: byId<HTMLParagraphElement>("mapping-status"),
};

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não encontrado`);
  return el as T;
}

let arquivoPath: string | null = null;
let arquivoBlob: File | null = null;

let csvImportadoTexto: string | null = null;
let arquivoParaImportar: File | null = null;

// ---------- inicialização ----------

function preencherAnos() {
  const anoAtual = new Date().getFullYear();
  const opcoes = ["Automático (recomendado)"];
  for (let ano = anoAtual; ano >= 2021; ano--) opcoes.push(String(ano));

  els.ano.innerHTML = opcoes
    .map((o) => `<option value="${o}">${o}</option>`)
    .join("");
}

function log(mensagem: string, tipo: "info" | "error" | "success" = "info") {
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const entry = document.createElement("span");
  entry.className = `entry ${tipo}`;

  const tsEl = document.createElement("span");
  tsEl.className = "ts";
  tsEl.textContent = hora;

  entry.appendChild(tsEl);
  entry.appendChild(document.createTextNode(mensagem));

  els.log.appendChild(entry);
  els.log.scrollTop = els.log.scrollHeight;
}

// ---------- arquivo ----------

function selecionarArquivo() {
  if (window.__TAURI__) {
    selecionarArquivoTauri();
  } else {
    els.fileInput.click();
  }
}

async function selecionarArquivoTauri() {
  const resultado = await window.__TAURI__!.invoke("selecionar_arquivo");
  if (!resultado?.caminho) return;

  arquivoPath = resultado.caminho;
  arquivoBlob = null;
  registrarArquivoSelecionado(resultado.caminho.split("/").pop());
}

function onFileInputChange() {
  const arquivo = els.fileInput.files?.[0];
  if (!arquivo) return;

  arquivoBlob = arquivo;
  arquivoPath = null;
  registrarArquivoSelecionado(arquivo.name);
}

function registrarArquivoSelecionado(nome: string) {
  els.fileName.textContent = nome;
  els.fileRow.classList.remove("empty");
  log(`Arquivo selecionado: ${nome}`);
}

function temArquivoSelecionado(): boolean {
  return arquivoPath !== null || arquivoBlob !== null;
}

// ---------- atualizações ----------

async function checarAtualizacoes() {
  const { hasUpdate, version, url } = await checkForUpdates();
  if (!hasUpdate || !url) return;

  els.updateText.textContent = `Versão ${version} disponível`;
  els.updateBanner.classList.add("visible");
  els.btnUpdate.onclick = () => openExternalLink(url);
  log(`Nova versão (${version}) disponível.`);
}

// ---------- abas ----------

type ViewName = "invoice" | "expenses" | "transactions";

function showView(view: ViewName) {
  els.viewInvoice.hidden = view !== "invoice";
  els.viewExpenses.hidden = view !== "expenses";
  els.viewTransactions.hidden = view !== "transactions";
  els.tabInvoice.classList.toggle("active", view === "invoice");
  els.tabExpenses.classList.toggle("active", view === "expenses");
  els.tabTransactions.classList.toggle("active", view === "transactions");
}

// ---------- tema ----------

const CHAVE_TEMA = "billie:tema";

function carregarTema() {
  const salvo = localStorage.getItem(CHAVE_TEMA);
  const tema = salvo === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = tema;
  atualizarIconeTema(tema);
}

function alternarTema() {
  const atual = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const novo = atual === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = novo;
  localStorage.setItem(CHAVE_TEMA, novo);
  atualizarIconeTema(novo);
}

const ICONE_SOL = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v3M12 18.2v3M4.3 4.3l2.1 2.1M17.6 17.6l2.1 2.1M2.8 12h3M18.2 12h3M4.3 19.7l2.1-2.1M17.6 6.4l2.1-2.1"/></svg>`;

const ICONE_LUA = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 14.6A8.5 8.5 0 1 1 9.4 3.8a7 7 0 0 0 10.8 10.8Z"/></svg>`;

function atualizarIconeTema(tema: string) {
  els.btnTema.innerHTML = tema === "light" ? ICONE_LUA : ICONE_SOL;
  els.btnTema.setAttribute("aria-label", tema === "light" ? "Mudar para tema escuro" : "Mudar para tema claro");
}

// ---------- colunas CSV ----------

const CHAVE_CONFIG_COLUNAS = "billie:csv-colunas";

function carregarConfigColunas() {
  let config: CsvColumnConfig = DEFAULT_CSV_COLUMNS;

  const salvo = localStorage.getItem(CHAVE_CONFIG_COLUNAS);
  if (salvo) {
    try {
      config = { ...DEFAULT_CSV_COLUMNS, ...JSON.parse(salvo) };
    } catch {
      config = DEFAULT_CSV_COLUMNS;
    }
  }

  els.colData.value = config.date;
  els.colEstabelecimento.value = config.merchant;
  els.colValor.value = config.amount;
}

function salvarConfigColunas() {
  localStorage.setItem(CHAVE_CONFIG_COLUNAS, JSON.stringify(obterConfigColunasAtual()));
}

function obterConfigColunasAtual(): CsvColumnConfig {
  return {
    date: els.colData.value.trim() || DEFAULT_CSV_COLUMNS.date,
    merchant: els.colEstabelecimento.value.trim() || DEFAULT_CSV_COLUMNS.merchant,
    amount: els.colValor.value.trim() || DEFAULT_CSV_COLUMNS.amount,
  };
}

function restaurarColunasPadrao() {
  els.colData.value = DEFAULT_CSV_COLUMNS.date;
  els.colEstabelecimento.value = DEFAULT_CSV_COLUMNS.merchant;
  els.colValor.value = DEFAULT_CSV_COLUMNS.amount;
  salvarConfigColunas();
}

// ---------- modal: salvar no controle de gastos ----------

function confirmarSalvarControleGastos(): Promise<boolean> {
  return new Promise((resolve) => {
    const finalizar = (resultado: boolean) => {
      els.modalSaveExpenses.hidden = true;
      els.modalSaveExpensesConfirm.removeEventListener("click", onConfirm);
      els.modalSaveExpensesSkip.removeEventListener("click", onSkip);
      resolve(resultado);
    };
    const onConfirm = () => finalizar(true);
    const onSkip = () => finalizar(false);

    els.modalSaveExpensesConfirm.addEventListener("click", onConfirm);
    els.modalSaveExpensesSkip.addEventListener("click", onSkip);
    els.modalSaveExpenses.hidden = false;
  });
}

// ---------- processamento ----------

async function processarFatura() {
  if (!temArquivoSelecionado()) {
    log("Nenhum arquivo selecionado.", "error");
    return;
  }

  els.btnProcessar.disabled = true;
  els.btnProcessar.textContent = "Processando...";
  log("Processando fatura...");

  try {
    if (!arquivoBlob) {
      throw new Error("Seleção de arquivo pelo Tauri ainda não implementada.");
    }

    await processarComoPdf(arquivoBlob);
  } catch (erro) {
    log(`Erro ao processar: ${erro}`, "error");
    els.btnProcessar.textContent = "Tentar novamente";
  } finally {
    els.btnProcessar.disabled = false;
  }
}

async function processarComoPdf(arquivo: File) {
  const pdfBytes = new Uint8Array(await arquivo.arrayBuffer());

  const resultado = await runPipeline({
    source: "pdf",
    pdfBytes,
    password: els.senha.value || undefined,
    bank: els.banco.value as Bank,
    year: els.ano.value,
    onLog: (mensagem) => log(mensagem),
  });

  if (!resultado.success || !resultado.transactions) {
    throw new Error(resultado.error ?? "erro desconhecido no processamento");
  }

  const periodo = periodoFatura(resultado.transactions);
  const nomeArquivo = nomeArquivoCsv(els.banco.value, periodo);
  baixarCsv(exportToCsv(resultado.transactions, obterConfigColunasAtual()), nomeArquivo);

  log(`Concluído — ${resultado.transactions.length} transações extraídas.`, "success");
  log(`Arquivo "${nomeArquivo}" salvo na pasta Downloads.`, "success");

  await salvarTransacoesNoControle(resultado.transactions, "pdf");
  els.btnProcessar.textContent = "Processar outra fatura";
}

async function salvarTransacoesNoControle(transactions: Transaction[], origin: StoredTransaction["origin"]) {
  const salvarNoControle = await confirmarSalvarControleGastos();
  if (!salvarNoControle) {
    log("Transações não foram salvas no controle de gastos.");
    return;
  }

  const { added, duplicates } = await classificarESalvarTransacoes(transactions, origin);
  log(
    `${added} transações novas salvas no controle de gastos${duplicates > 0 ? ` (${duplicates} já existiam)` : ""}.`,
    "success"
  );

  document.dispatchEvent(new Event(EXPENSES_UPDATED_EVENT));
}

async function classificarESalvarTransacoes(transactions: Transaction[], origin: StoredTransaction["origin"]) {
  const rules = await listCategoryRules();
  const categorized = classifyTransactionList(transactions, rules);
  const storedTransactions: StoredTransaction[] = categorized.map((transaction) => ({
    ...transaction,
    origin,
  }));
  return saveTransactions(storedTransactions);
}

// ---------- importar extrato (aba transações) ----------

type StatusReporter = (mensagem: string, tipo?: "info" | "success" | "error") => void;

type EtapaImportacao = "select" | "confirm" | "status" | "mapping";

function mostrarEtapaImportacao(etapa: EtapaImportacao) {
  els.importStepSelect.hidden = etapa !== "select";
  els.importStepConfirm.hidden = etapa !== "confirm";
  els.importStepStatus.hidden = etapa !== "status";
  els.importStepMapping.hidden = etapa !== "mapping";
}

function resetarFluxoImportacao() {
  arquivoParaImportar = null;
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

function onImportFileInputChange() {
  const arquivo = els.importFileInput.files?.[0];
  els.importFileInput.value = "";
  if (!arquivo) return;

  arquivoParaImportar = arquivo;
  els.importConfirmText.textContent = `Importar o arquivo "${arquivo.name}"?`;
  mostrarEtapaImportacao("confirm");
}

function onCancelarImportacaoClick() {
  arquivoParaImportar = null;
  mostrarEtapaImportacao("select");
}

async function onConfirmarImportacaoClick() {
  if (!arquivoParaImportar) return;
  const arquivo = arquivoParaImportar;
  arquivoParaImportar = null;

  mostrarEtapaImportacao("status");
  setImportStatus("Importando extrato...");

  try {
    csvImportadoTexto = await arquivo.text();
    await processarImportacaoCsv(csvImportadoTexto, undefined, setImportStatus);
  } catch (erro) {
    setImportStatus(`Erro ao importar extrato: ${erro}`, "error");
  }
}

async function processarImportacaoCsv(
  csvText: string,
  columns: CsvColumnConfig | undefined,
  reportar: StatusReporter
) {
  const resultado = await runPipeline({
    source: "csv",
    csvText,
    columns,
    onLog: () => {},
  });

  if (!resultado.success || !resultado.transactions) {
    if (resultado.needsColumnMapping) {
      mostrarMapeamentoManualImportacao(resultado.needsColumnMapping.headers);
      return;
    }
    throw new Error(resultado.error ?? "erro desconhecido no processamento");
  }

  const { added, duplicates } = await classificarESalvarTransacoes(resultado.transactions, "csv");

  if (resultado.income && resultado.income.length > 0) {
    const incomeEntries: ManualIncomeEntry[] = resultado.income.map((entry) => ({
      id: entry.id,
      date: entry.date,
      description: entry.merchant,
      amount: entry.amount,
    }));
    await saveIncomeEntries(incomeEntries);
  }

  document.dispatchEvent(new Event(EXPENSES_UPDATED_EVENT));
  reportar(
    `${added} transações importadas${duplicates > 0 ? ` (${duplicates} já existiam)` : ""}.`,
    "success"
  );
}

function mostrarMapeamentoManualImportacao(headers: string[]) {
  const options = headers.map((h) => `<option value="${h}">${h}</option>`).join("");
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

  els.btnConfirmarMapeamento.disabled = true;
  setMappingStatus("Importando extrato...");
  try {
    await processarImportacaoCsv(csvImportadoTexto, columns, setMappingStatus);
  } catch (erro) {
    setMappingStatus(`Erro ao importar extrato: ${erro}`, "error");
  } finally {
    els.btnConfirmarMapeamento.disabled = false;
  }
}

function nomeArquivoCsv(banco: string, periodo: string): string {
  const bancoSlug = banco
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `fatura-${bancoSlug}-${periodo}.csv`;
}

function periodoFatura(transacoes: Transaction[]): string {
  if (transacoes.length === 0) return new Date().toISOString().slice(0, 7);
  const periodos = transacoes.map((t) => t.date.slice(0, 7)); // "YYYY-MM" direto da string ISO
  return maisFrequente(periodos);
}

function maisFrequente(valores: string[]): string {
  const contagem = new Map<string, number>();
  for (const valor of valores) contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function baixarCsv(csv: string, nomeArquivo: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();

  URL.revokeObjectURL(url);
}

// ---------- eventos ----------

function bindEvents() {
  els.btnImportExtrato.addEventListener("click", alternarPopoverImportacao);
  els.btnSelecionarCsv.addEventListener("click", () => els.importFileInput.click());
  els.importFileInput.addEventListener("change", onImportFileInputChange);
  els.btnConfirmarImportacao.addEventListener("click", onConfirmarImportacaoClick);
  els.btnCancelarImportacao.addEventListener("click", onCancelarImportacaoClick);
  els.btnFecharImportacao.addEventListener("click", fecharPopoverImportacao);
  els.btnConfirmarMapeamento.addEventListener("click", onConfirmarMapeamentoImportacao);
  document.addEventListener("click", onCliqueForaPopoverImportacao);

  els.btnTema.addEventListener("click", alternarTema);
  els.btnCategories.addEventListener("click", () => { els.modalCategories.hidden = false; });
  els.modalCategoriesClose.addEventListener("click", () => { els.modalCategories.hidden = true; });
  els.tabInvoice.addEventListener("click", () => showView("invoice"));
  els.tabExpenses.addEventListener("click", () => showView("expenses"));
  els.tabTransactions.addEventListener("click", () => showView("transactions"));
  els.fileRow.addEventListener("click", selecionarArquivo);
  els.fileInput.addEventListener("change", onFileInputChange);
  els.btnProcessar.addEventListener("click", processarFatura);

  els.colData.addEventListener("blur", salvarConfigColunas);
  els.colEstabelecimento.addEventListener("blur", salvarConfigColunas);
  els.colValor.addEventListener("blur", salvarConfigColunas);
  els.btnRestaurarColunas.addEventListener("click", restaurarColunasPadrao);
}

// ---------- boot ----------

carregarTema();
preencherAnos();
carregarConfigColunas();
bindEvents();
checarAtualizacoes();
initExpensesView();
showView("invoice");
log("Pronto para iniciar. Selecione o arquivo PDF.");