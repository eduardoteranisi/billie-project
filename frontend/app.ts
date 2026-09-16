import { checkForUpdates, openExternalLink } from "./services/update_checker";
import { initExpensesView } from "./screens/expenses";
import { initInvoiceView, log } from "./screens/invoice";
import { initTransactionsView } from "./screens/transactions";

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
};

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não encontrado`);
  return el as T;
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

// ---------- eventos ----------

function bindEvents() {
  els.btnTema.addEventListener("click", alternarTema);
  els.btnCategories.addEventListener("click", () => { els.modalCategories.hidden = false; });
  els.modalCategoriesClose.addEventListener("click", () => { els.modalCategories.hidden = true; });
  els.modalCategories.addEventListener("click", (event) => {
    if (event.target === els.modalCategories) els.modalCategories.hidden = true;
  });
  els.tabInvoice.addEventListener("click", () => showView("invoice"));
  els.tabExpenses.addEventListener("click", () => showView("expenses"));
  els.tabTransactions.addEventListener("click", () => showView("transactions"));
}

// ---------- boot ----------

carregarTema();
bindEvents();
initInvoiceView();
initTransactionsView();
checarAtualizacoes();
initExpensesView();
showView("invoice");
log("Pronto para iniciar. Selecione a fatura em PDF ou CSV.");
