const CURRENT_VERSION = "v2.0.0";
const GITHUB_REPO = "eduardoteranisi/billie-project";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  version: string;
  url: string | null;
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (!response.ok) return noUpdateAvailable();

    const data = await response.json();
    const cloudVersion: string | undefined = data.tag_name;
    const downloadUrl: string | undefined = data.html_url;

    if (cloudVersion && cloudVersion !== CURRENT_VERSION) {
      return { hasUpdate: true, version: cloudVersion, url: downloadUrl ?? null };
    }

    return noUpdateAvailable();
  } catch {
    return noUpdateAvailable();
  }
}

function noUpdateAvailable(): UpdateCheckResult {
  return { hasUpdate: false, version: CURRENT_VERSION, url: null };
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
