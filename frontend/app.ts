import { runPipeline, exportToCsv, type Bank } from "@billie/parser";
import { checkForUpdates, openExternalLink } from "./services/update_checker";

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

  fileRow: byId<HTMLButtonElement>("file-row"),
  fileName: byId<HTMLSpanElement>("file-name"),
  fileInput: byId<HTMLInputElement>("file-input"),

  senha: byId<HTMLInputElement>("senha"),
  banco: byId<HTMLSelectElement>("banco"),
  ano: byId<HTMLSelectElement>("ano"),

  btnProcessar: byId<HTMLButtonElement>("btn-processar"),
  log: byId<HTMLDivElement>("log"),
};

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não encontrado`);
  return el as T;
}

let arquivoPath: string | null = null;
let arquivoBlob: File | null = null;     

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

    const pdfBytes = new Uint8Array(await arquivoBlob.arrayBuffer());

    const resultado = await runPipeline({
      pdfBytes,
      password: els.senha.value || undefined,
      bank: els.banco.value as Bank,
      year: els.ano.value,
      onLog: (mensagem) => log(mensagem),
    });

    if (!resultado.success || !resultado.transactions) {
      throw new Error(resultado.error ?? "erro desconhecido no processamento");
    }

    const nomeArquivo = nomeArquivoCsv(els.banco.value);
    baixarCsv(exportToCsv(resultado.transactions), nomeArquivo);

    log(`Concluído — ${resultado.transactions.length} transações extraídas.`, "success");
    log(`Arquivo "${nomeArquivo}" salvo na pasta Downloads.`, "success");
    els.btnProcessar.textContent = "Processar outra fatura";
  } catch (erro) {
    log(`Erro ao processar: ${erro}`, "error");
    els.btnProcessar.textContent = "Tentar novamente";
  } finally {
    els.btnProcessar.disabled = false;
  }
}

function nomeArquivoCsv(banco: string): string {
  const bancoSlug = banco
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const data = new Date().toISOString().slice(0, 10);
  return `fatura-${bancoSlug}-${data}.csv`;
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
  els.fileRow.addEventListener("click", selecionarArquivo);
  els.fileInput.addEventListener("change", onFileInputChange);
  els.btnProcessar.addEventListener("click", processarFatura);
}

// ---------- boot ----------

preencherAnos();
bindEvents();
checarAtualizacoes();
log("Pronto para iniciar. Selecione o arquivo PDF.");