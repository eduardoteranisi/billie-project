import { installSelectPickerMenu } from "./components/select_picker";
import type { Update } from "@tauri-apps/plugin-updater";
import {
  checkForAvailableUpdate,
  installUpdateAndRelaunch,
  openExternalLink,
  RELEASES_PAGE_URL,
} from "./services/update_checker";
import { initExpensesView } from "./screens/expenses";
import { initInvoiceView, log } from "./screens/invoice";
import { initTransactionsView } from "./screens/transactions";
import { getRequiredElementById } from "./utils/dom_helpers";

// ---------- referências de DOM ----------

const els = {
  updateBanner: getRequiredElementById<HTMLDivElement>("update-banner"),
  updateText: getRequiredElementById<HTMLSpanElement>("update-text"),
  btnUpdate: getRequiredElementById<HTMLButtonElement>("btn-update"),
  btnTheme: getRequiredElementById<HTMLButtonElement>("btn-tema"),
  btnCategories: getRequiredElementById<HTMLButtonElement>("btn-categories"),
  modalCategories: getRequiredElementById<HTMLDivElement>("modal-categories"),
  modalCategoriesClose: getRequiredElementById<HTMLButtonElement>("modal-categories-close"),
  btnBackup: getRequiredElementById<HTMLButtonElement>("btn-backup"),
  modalBackup: getRequiredElementById<HTMLDivElement>("modal-backup"),
  modalBackupClose: getRequiredElementById<HTMLButtonElement>("modal-backup-close"),
  backupStatus: getRequiredElementById<HTMLParagraphElement>("backup-status"),

  tabInvoice: getRequiredElementById<HTMLButtonElement>("tab-invoice"),
  tabExpenses: getRequiredElementById<HTMLButtonElement>("tab-expenses"),
  tabTransactions: getRequiredElementById<HTMLButtonElement>("tab-transactions"),
  viewInvoice: getRequiredElementById<HTMLDivElement>("view-invoice"),
  viewExpenses: getRequiredElementById<HTMLDivElement>("view-expenses"),
  viewTransactions: getRequiredElementById<HTMLDivElement>("view-transactions"),
};

// ---------- atualizações ----------

async function checkForUpdates() {
  const update = await checkForAvailableUpdate();
  if (!update) return;

  els.updateText.textContent = `Versão ${update.version} disponível`;
  els.updateBanner.classList.add("visible");
  els.btnUpdate.onclick = () => installUpdate(update);
  log(`Nova versão (${update.version}) disponível.`);
}

async function installUpdate(update: Update) {
  els.btnUpdate.disabled = true;
  els.updateText.textContent = "Baixando atualização...";

  try {
    await installUpdateAndRelaunch(update, (percent) => {
      els.updateText.textContent =
        percent === null ? "Baixando atualização..." : `Baixando atualização... ${percent}%`;
    });
  } catch (error) {
    // ex.: senha do pkexec cancelada no .deb, ou sem entrada para este instalador no latest.json
    log(`Falha ao instalar a atualização: ${error}`);
    els.updateText.textContent = `Não foi possível atualizar automaticamente. Baixe a versão ${update.version} manualmente.`;
    els.btnUpdate.textContent = "Baixar";
    els.btnUpdate.disabled = false;
    els.btnUpdate.onclick = () => openExternalLink(RELEASES_PAGE_URL);
  }
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

const THEME_STORAGE_KEY = "billie:tema";

function loadTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const theme = saved === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  updateThemeIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_STORAGE_KEY, next);
  updateThemeIcon(next);
}

const SUN_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v3M12 18.2v3M4.3 4.3l2.1 2.1M17.6 17.6l2.1 2.1M2.8 12h3M18.2 12h3M4.3 19.7l2.1-2.1M17.6 6.4l2.1-2.1"/></svg>`;

const MOON_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 14.6A8.5 8.5 0 1 1 9.4 3.8a7 7 0 0 0 10.8 10.8Z"/></svg>`;

function updateThemeIcon(theme: string) {
  els.btnTheme.innerHTML = theme === "light" ? MOON_ICON : SUN_ICON;
  els.btnTheme.setAttribute("aria-label", theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro");
}

// ---------- eventos ----------

function bindEvents() {
  els.btnTheme.addEventListener("click", toggleTheme);
  els.btnCategories.addEventListener("click", () => { els.modalCategories.hidden = false; });
  els.modalCategoriesClose.addEventListener("click", () => { els.modalCategories.hidden = true; });
  els.modalCategories.addEventListener("click", (event) => {
    if (event.target === els.modalCategories) els.modalCategories.hidden = true;
  });
  els.btnBackup.addEventListener("click", () => {
    els.modalBackup.hidden = false;
    els.backupStatus.hidden = true;
  });
  els.modalBackupClose.addEventListener("click", () => { els.modalBackup.hidden = true; });
  els.modalBackup.addEventListener("click", (event) => {
    if (event.target === els.modalBackup) els.modalBackup.hidden = true;
  });
  els.tabInvoice.addEventListener("click", () => showView("invoice"));
  els.tabExpenses.addEventListener("click", () => showView("expenses"));
  els.tabTransactions.addEventListener("click", () => showView("transactions"));
}

// ---------- boot ----------

loadTheme();
installSelectPickerMenu();
bindEvents();
initInvoiceView();
initTransactionsView();
checkForUpdates();
initExpensesView();
showView("invoice");
log("Pronto para iniciar. Selecione a fatura em PDF ou CSV.");
