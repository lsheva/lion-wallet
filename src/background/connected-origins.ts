const CONNECTED_ORIGINS_KEY = "connectedOrigins";

let cache = new Set<string>();
let loadPromise: Promise<void> | null = null;

export async function ensureConnectedOriginsLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const r = await browser.storage.local.get(CONNECTED_ORIGINS_KEY);
    const list = (r[CONNECTED_ORIGINS_KEY] as string[] | undefined) ?? [];
    cache = new Set(list);
  })();
  return loadPromise;
}

export function isOriginConnected(origin: string): boolean {
  return cache.has(origin);
}

export async function addConnectedOrigin(origin: string): Promise<void> {
  cache.add(origin);
  await browser.storage.local.set({ [CONNECTED_ORIGINS_KEY]: [...cache] });
}

export async function removeConnectedOrigin(origin: string): Promise<void> {
  cache.delete(origin);
  await browser.storage.local.set({ [CONNECTED_ORIGINS_KEY]: [...cache] });
}

export function getConnectedOrigins(): string[] {
  return [...cache].sort();
}

export async function clearConnectedOrigins(): Promise<void> {
  cache.clear();
  await browser.storage.local.remove(CONNECTED_ORIGINS_KEY);
  loadPromise = null;
}
