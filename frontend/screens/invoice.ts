import {
  runPipeline,
  exportToCsv,
  DEFAULT_CSV_COLUMNS,
  type Bank,
  type CsvColumnConfig,
  type Transaction,
} from "@billie/parser";
import {
  classificarESalvarTransacoes,
  salvarIncomeNoControle,
  somarResultadosSalvamento,
} from "../services/transaction_saver";
import { EXPENSES_UPDATED_EVENT } from "./expenses";
import type { StoredTransaction } from "../types";

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<any>;

declare global {
  interface Window {
    __TAURI__?: { invoke: InvokeFn };
  }
}

export const ANO_AUTOMATICO = "Automático (recomendado)";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não encontrado`);
  return el as T;
}

export function log(mensagem: string, tipo: "info" | "error" | "success" = "info") {
  const logEl = byId<HTMLDivElement>("log");
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const entry = document.createElement("span");
  entry.className = `entry ${tipo}`;

  const tsEl = document.createElement("span");
  tsEl.className = "ts";
  tsEl.textContent = hora;

  entry.appendChild(tsEl);
  entry.appendChild(document.createTextNode(mensagem));

  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

export function initInvoiceView(): void {
  const els = {
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

    modalSaveExpenses: byId<HTMLDivElement>("modal-save-expenses"),
    modalSaveExpensesConfirm: byId<HTMLButtonElement>("modal-save-expenses-confirm"),
    modalSaveExpensesSkip: byId<HTMLButtonElement>("modal-save-expenses-skip"),
  };

  let arquivoPath: string | null = null;
  let arquivoBlob: File | null = null;

  function preencherAnos(select: HTMLSelectElement) {
    const anoAtual = new Date().getFullYear();
    const opcoes = [ANO_AUTOMATICO];
    for (let ano = anoAtual; ano >= 2021; ano--) opcoes.push(String(ano));

    select.innerHTML = opcoes
      .map((o) => `<option value="${o}">${o}</option>`)
      .join("");
  }

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

    const todasTransacoes = [...resultado.transactions, ...(resultado.income ?? [])];
    const periodo = periodoFatura(todasTransacoes);
    const nomeArquivo = nomeArquivoCsv(els.banco.value, periodo);
    baixarCsv(exportToCsv(todasTransacoes, obterConfigColunasAtual()), nomeArquivo);

    log(`Concluído — ${todasTransacoes.length} transações extraídas.`, "success");
    log(`Arquivo "${nomeArquivo}" salvo na pasta Downloads.`, "success");

    await salvarTransacoesNoControle(resultado.transactions, resultado.income, "pdf");
    els.btnProcessar.textContent = "Processar outra fatura";
  }

  async function salvarTransacoesNoControle(
    transactions: Transaction[],
    income: Transaction[] | undefined,
    origin: StoredTransaction["origin"]
  ) {
    const salvarNoControle = await confirmarSalvarControleGastos();
    if (!salvarNoControle) {
      log("Transações não foram salvas no controle de gastos.");
      return;
    }

    const resultadoTransacoes = await classificarESalvarTransacoes(transactions, origin);
    const resultadoIncome = await salvarIncomeNoControle(income);
    const { added, duplicates } = somarResultadosSalvamento(resultadoTransacoes, resultadoIncome);
    log(
      `${added} transações novas salvas no controle de gastos${duplicates > 0 ? ` (${duplicates} já existiam)` : ""}.`,
      "success"
    );

    document.dispatchEvent(new Event(EXPENSES_UPDATED_EVENT));
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

  function bindEvents() {
    els.fileRow.addEventListener("click", selecionarArquivo);
    els.fileInput.addEventListener("change", onFileInputChange);
    els.btnProcessar.addEventListener("click", processarFatura);

    els.colData.addEventListener("blur", salvarConfigColunas);
    els.colEstabelecimento.addEventListener("blur", salvarConfigColunas);
    els.colValor.addEventListener("blur", salvarConfigColunas);
    els.btnRestaurarColunas.addEventListener("click", restaurarColunasPadrao);
  }

  preencherAnos(els.ano);
  carregarConfigColunas();
  bindEvents();
}
