import { confirmAction } from "../components/confirm_modal";
import { BackupValidationError, exportBackupData, restoreBackupData } from "../services/expense_store";
import { notifyStoredDataUpdated } from "../services/stored_data_events";
import { getRequiredElementById } from "../utils/dom_helpers";
import { downloadTextFile } from "../utils/file_helpers";

export function initBackupModal(): void {
  const btnOpen = getRequiredElementById<HTMLButtonElement>("btn-backup");
  const modal = getRequiredElementById<HTMLDivElement>("modal-backup");
  const btnClose = getRequiredElementById<HTMLButtonElement>("modal-backup-close");
  const btnExportBackup = getRequiredElementById<HTMLButtonElement>("btn-exportar-backup");
  const btnImportBackup = getRequiredElementById<HTMLButtonElement>("btn-importar-backup");
  const backupFileInput = getRequiredElementById<HTMLInputElement>("backup-file-input");
  const backupStatus = getRequiredElementById<HTMLParagraphElement>("backup-status");

  bindEvents();

  function showBackupStatus(message: string, type: "success" | "error"): void {
    backupStatus.textContent = message;
    backupStatus.classList.toggle("success", type === "success");
    backupStatus.classList.toggle("error", type === "error");
    backupStatus.hidden = false;
  }

  async function onExportBackupClick(): Promise<void> {
    const payload = await exportBackupData();
    const fileName = buildBackupFileName();
    downloadTextFile(JSON.stringify(payload, null, 2), fileName, "application/json");
    showBackupStatus(`Backup exportado: ${fileName}`, "success");
  }

  async function onBackupFileSelected(): Promise<void> {
    const file = backupFileInput.files?.[0];
    backupFileInput.value = "";
    if (!file) return;

    backupStatus.hidden = true;

    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      showBackupStatus("Arquivo inválido: não é um JSON válido.", "error");
      return;
    }

    const confirmed = await confirmAction(
      "Restaurar este backup? Lançamentos e categorias com o mesmo identificador do arquivo serão sobrescritos; o restante dos dados atuais é preservado."
    );
    if (!confirmed) return;

    try {
      await restoreBackupData(payload);
      notifyStoredDataUpdated();
      showBackupStatus("Backup restaurado com sucesso.", "success");
    } catch (error) {
      const message = error instanceof BackupValidationError ? error.message : "Não foi possível restaurar o backup.";
      showBackupStatus(message, "error");
    }
  }

  function bindEvents(): void {
    btnOpen.addEventListener("click", () => {
      modal.hidden = false;
      backupStatus.hidden = true;
    });
    btnClose.addEventListener("click", () => { modal.hidden = true; });
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.hidden = true;
    });
    btnExportBackup.addEventListener("click", () => void onExportBackupClick());
    btnImportBackup.addEventListener("click", () => backupFileInput.click());
    backupFileInput.addEventListener("change", () => void onBackupFileSelected());
  }
}

function buildBackupFileName(): string {
  return `billie-backup-${new Date().toISOString().slice(0, 10)}.json`;
}
