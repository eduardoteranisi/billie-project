import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export const RELEASES_PAGE_URL = "https://github.com/eduardoteranisi/billie-project/releases/latest";

const UPDATE_CHECK_TIMEOUT_MS = 5000;

// A versão instalada vem do tauri.conf.json: o plugin compara com o latest.json da última Release publicada
// e só aceita o download se a assinatura bater com a chave pública do tauri.conf.json.
// No navegador (npm run dev) não existe updater, então não há o que checar.
export async function checkForAvailableUpdate(): Promise<Update | null> {
  if (!isTauri()) return null;

  try {
    return await check({ timeout: UPDATE_CHECK_TIMEOUT_MS });
  } catch {
    return null;
  }
}

// No Windows o instalador fecha o app sozinho, então o relaunch só chega a rodar no Linux.
export async function installUpdateAndRelaunch(
  update: Update,
  onDownloadProgress: (percent: number | null) => void
): Promise<void> {
  let totalBytes = 0;
  let downloadedBytes = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      totalBytes = event.data.contentLength ?? 0;
    } else if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
      onDownloadProgress(totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : null);
    }
  });

  await relaunch();
}

export function openExternalLink(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
    return;
  }

  window.open(url, "_blank");
}
