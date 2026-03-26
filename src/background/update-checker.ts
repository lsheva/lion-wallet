import { bgLog } from "./log";

const REPO = "lsheva/lion-wallet";
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const STORAGE_KEY = "lion_update_cache";

interface UpdateCache {
  latestVersion: string;
  downloadUrl: string;
  checkedAt: number;
}

export interface UpdateInfo {
  current: string;
  latest: string;
  downloadUrl: string;
  updateAvailable: boolean;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function getCached(): Promise<UpdateCache | null> {
  const { [STORAGE_KEY]: cached } = await browser.storage.local.get(STORAGE_KEY);
  return (cached as UpdateCache) ?? null;
}

async function fetchLatestRelease(): Promise<{ version: string; downloadUrl: string } | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tag_name: string;
      html_url: string;
      assets?: Array<{ name: string; browser_download_url: string }>;
    };
    const version = data.tag_name.replace(/^v/, "");
    const dmg = data.assets?.find((a) => a.name.endsWith(".dmg"));
    return { version, downloadUrl: dmg?.browser_download_url ?? data.html_url };
  } catch (e) {
    bgLog("[update-checker] fetch failed:", e);
    return null;
  }
}

export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const current = browser.runtime.getManifest().version;

  const cached = await getCached();
  if (!force && cached && Date.now() - cached.checkedAt < CHECK_INTERVAL_MS) {
    return {
      current,
      latest: cached.latestVersion,
      downloadUrl: cached.downloadUrl,
      updateAvailable: compareVersions(cached.latestVersion, current) > 0,
    };
  }

  const release = await fetchLatestRelease();
  if (!release) {
    if (cached) {
      return {
        current,
        latest: cached.latestVersion,
        downloadUrl: cached.downloadUrl,
        updateAvailable: compareVersions(cached.latestVersion, current) > 0,
      };
    }
    return { current, latest: current, downloadUrl: "", updateAvailable: false };
  }

  const cacheEntry: UpdateCache = {
    latestVersion: release.version,
    downloadUrl: release.downloadUrl,
    checkedAt: Date.now(),
  };
  await browser.storage.local.set({ [STORAGE_KEY]: cacheEntry });

  return {
    current,
    latest: release.version,
    downloadUrl: release.downloadUrl,
    updateAvailable: compareVersions(release.version, current) > 0,
  };
}
