// Linux image cache. A module-level singleton, same shape as Biri's model
// brain: a download the user started keeps streaming after the window closes
// (the promise outlives the component), and a finished image lives in the
// Cache API so it survives a reload. Re-opening the app re-attaches to the
// same state. The Ghostty boot backend reads the same cache.
import { DISTROS, findDistro, type Distro } from "./data/distros";

const CACHE_STORE = "linux-cache";

// Images come straight from the v86 image host. VITE_LINUX_IMAGE_BASE is a
// dev/test escape hatch (a same-origin path); production uses i.copy.sh.
const IMAGE_BASE =
  (import.meta.env.VITE_LINUX_IMAGE_BASE as string | undefined) ?? "https://i.copy.sh/";

const ASSET_BASE = import.meta.env.BASE_URL;

export interface DownloadProgress {
  loaded: number;
  total: number;
}

export interface LinuxStoreState {
  version: number;
  /** Distro ids whose image is fully cached. */
  cached: readonly string[];
  /** In-flight downloads, keyed by distro id. */
  progress: Readonly<Record<string, DownloadProgress>>;
  /** Last error per distro id. */
  errors: Readonly<Record<string, string>>;
}

let cached = new Set<string>();
let progress: Record<string, DownloadProgress> = {};
let errors: Record<string, string> = {};
let version = 0;
let snapshot: LinuxStoreState = { version, cached: [], progress, errors };

const listeners = new Set<() => void>();

function emit(): void {
  version += 1;
  snapshot = {
    version,
    cached: [...cached],
    progress: { ...progress },
    errors: { ...errors },
  };
  for (const listener of listeners) listener();
}

export function subscribeLinux(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLinuxState(): LinuxStoreState {
  return snapshot;
}

/** Absolute URL for an image file; also the Cache API key. */
export function imageUrl(image: string): string {
  return new URL(IMAGE_BASE + image, window.location.href).href;
}

/** Sync view of what's cached; the shell command reads this. */
export function getCachedIds(): string[] {
  return [...cached];
}

export function isCached(id: string): boolean {
  return cached.has(id);
}

/** Probe the Cache API for every distro's image and rebuild the cached set. */
export async function refreshCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_STORE);
    const keys = await cache.keys();
    // Cache keys are absolute URLs; imageUrl() may be a relative dev path.
    const urls = new Set(keys.map((request) => request.url));
    const next = new Set<string>();
    for (const distro of DISTROS) {
      if (!distro.boot) continue;
      if (urls.has(imageUrl(distro.boot.image))) next.add(distro.id);
    }
    cached = next;
    emit();
  } catch {
    // Cache API unavailable (private mode); the app still works online.
  }
}

/** Start (or no-op if already cached/downloading) an image download. */
export async function download(id: string): Promise<void> {
  const distro = findDistro(id);
  if (!distro?.boot) return;
  if (cached.has(id) || progress[id]) return;

  const url = imageUrl(distro.boot.image);
  const fallbackTotal = distro.boot.bytes;
  progress = { ...progress, [id]: { loaded: 0, total: fallbackTotal } };
  if (errors[id]) {
    const rest = { ...errors };
    delete rest[id];
    errors = rest;
  }
  emit();

  try {
    // i.copy.sh sits behind Bunny CDN with hotlink protection: it only serves
    // requests whose Referer is copy.sh (or absent). The browser's default
    // cross-origin Referer gets a 403, so send none.
    const response = await fetch(url, { referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    const total = Number(response.headers.get("content-length")) || fallbackTotal;

    const reader = response.body?.getReader();
    let blob: Blob;
    if (reader) {
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.byteLength;
          progress = { ...progress, [id]: { loaded, total } };
          emit();
        }
      }
      const merged = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      blob = new Blob([merged], { type: "application/octet-stream" });
    } else {
      const buffer = await response.arrayBuffer();
      blob = new Blob([buffer], { type: "application/octet-stream" });
    }

    await put(url, blob);
    const next = new Set(cached);
    next.add(id);
    cached = next;
    const rest = { ...progress };
    delete rest[id];
    progress = rest;
    emit();
  } catch (error) {
    const rest = { ...progress };
    delete rest[id];
    progress = rest;
    errors = {
      ...errors,
      [id]: error instanceof Error ? error.message : String(error),
    };
    emit();
  }
}

export async function remove(id: string): Promise<void> {
  const distro = findDistro(id);
  if (!distro?.boot || typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_STORE);
    await cache.delete(imageUrl(distro.boot.image));
    if (cached.has(id)) {
      const next = new Set(cached);
      next.delete(id);
      cached = next;
      emit();
    }
  } catch {
    // ignore
  }
}

async function put(url: string, blob: Blob): Promise<void> {
  if (typeof caches === "undefined") throw new Error("cache storage unavailable");
  const cache = await caches.open(CACHE_STORE);
  await cache.put(
    url,
    new Response(blob, {
      headers: { "content-type": "application/octet-stream" },
    }),
  );
}

/* ── boot assets ─────────────────────────────────────────────── */

export interface BootAssets {
  bzimage: ArrayBuffer;
  bios: ArrayBuffer;
  vgabios: ArrayBuffer;
}

let biosBuffer: ArrayBuffer | null = null;
let vgaBiosBuffer: ArrayBuffer | null = null;

async function loadAsset(
  name: string,
  current: ArrayBuffer | null,
): Promise<ArrayBuffer> {
  if (current) return current;
  const response = await fetch(`${ASSET_BASE}linux/${name}`);
  if (!response.ok) throw new Error(`failed to load ${name}`);
  return response.arrayBuffer();
}

/** Read the cached kernel plus the vendored BIOS images, ready for v86. */
export async function getBootAssets(distro: Distro): Promise<BootAssets> {
  if (!distro.boot) throw new Error(`${distro.id} is not bootable`);
  if (typeof caches === "undefined") throw new Error("cache storage unavailable");

  const cache = await caches.open(CACHE_STORE);
  const response = await cache.match(imageUrl(distro.boot.image));
  if (!response) throw new Error(`${distro.name} is not downloaded`);
  const bzimage = await response.arrayBuffer();

  biosBuffer = await loadAsset("seabios.bin", biosBuffer);
  vgaBiosBuffer = await loadAsset("vgabios.bin", vgaBiosBuffer);

  return { bzimage, bios: biosBuffer, vgabios: vgaBiosBuffer };
}
