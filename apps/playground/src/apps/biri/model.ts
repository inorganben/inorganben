// Biri's model brain: a module-level singleton so a download that the user
// confirmed keeps streaming even after the window closes (the component
// unmounts; the promise outlives it). Re-opening the app re-attaches to the
// same state. transformers.js persists finished files in the Cache API, so a
// completed download also survives a full page reload.
import type { ProgressInfo } from "@huggingface/transformers";

export type ModelKind = "q8" | "q4";

export interface BiriState {
  phase: "idle" | "loading" | "ready" | "error";
  kind: ModelKind | null;
  /** Bytes downloaded / known total across all files (total 0 until seen). */
  loaded: number;
  total: number;
  error: string;
  /** Last generation's ms per emitted token; 0 until first run. */
  msPerToken: number;
  /** True when loading from a cache hit (silent) vs. a user-initiated download. */
  auto: boolean;
}

const MODEL_ID = "gpt2-tiny-chinese";

// Remember the user's chosen tier so reopening the window auto-loads it when
// the model is already in cache (no re-confirmation, no re-download).
const KIND_KEY = "biri.kind";

function saveKind(kind: ModelKind): void {
  try {
    localStorage.setItem(KIND_KEY, kind);
  } catch {
    // localStorage may be unavailable (private mode); the app still works
    // via the in-session cache.
  }
}

function loadKind(): ModelKind | null {
  try {
    const v = localStorage.getItem(KIND_KEY);
    return v === "q8" || v === "q4" ? v : null;
  } catch {
    return null;
  }
}

// The onnx model file that lands in transformers.js's Cache API once the
// download completes. Probing it tells us whether a given tier is already
// local, so we can skip the confirmation gate without a spurious download.
// The cache key is the full local model URL; match by suffix to stay
// agnostic to the origin / base path.
async function probeCache(kind: ModelKind): Promise<boolean> {
  const file = kind === "q8" ? "model_quantized.onnx" : "model_q4.onnx";
  try {
    if (typeof caches === "undefined") return false;
    const cacheNames = await caches.keys();
    if (!cacheNames.includes("transformers-cache")) return false;
    const cache = await caches.open("transformers-cache");
    return (await cache.keys()).some(
      (r) => typeof r.url === "string" && r.url.endsWith(`/${MODEL_ID}/onnx/${file}`),
    );
  } catch {
    return false;
  }
}

const LABELS: Record<ModelKind, { name: string; size: string; note: string }> = {
  q8: { name: "大模型", size: "~12 MB", note: "句子通顺" },
  q4: { name: "小模型", size: "~6 MB", note: "语法半残" },
};
export const MODEL_LABELS = LABELS;

let state: BiriState = {
  phase: "idle",
  kind: null,
  loaded: 0,
  total: 0,
  error: "",
  msPerToken: 0,
  // A returning user (remembered tier) starts silent so the first frame is a
  // neutral placeholder instead of a flash of the download gate; a new user
  // renders the gate immediately.
  auto: loadKind() !== null,
};
const listeners = new Set<() => void>();

function set(patch: Partial<BiriState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getBiriState(): BiriState {
  return state;
}
export function subscribeBiri(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// v4 dispatches an aggregate "progress_total" event (loaded/total across all
// files); consuming only that keeps the bar monotone without hand-rolling a
// per-file ledger.
function onProgress(p: ProgressInfo) {
  if (p.status === "progress_total") set({ loaded: p.loaded, total: p.total });
}

let pipePromise: Promise<Awaited<ReturnType<typeof buildGenerator>> | null> | null =
  null;

async function buildGenerator(kind: ModelKind) {
  const { pipeline } = await import("@huggingface/transformers");
  const { env } = await import("@huggingface/transformers");
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  // IMPORTANT: localModelPath must stay a *relative* path ("/models/").
  // transformers.js probes file existence only for non-http paths; an
  // absolute http URL skips that probe and (with allowRemoteModels=false)
  // reports every file as missing -> the tokenizer silently loads as null.
  // BASE_URL is "/" in dev and "/<repo>/" on Pages — both are relative
  // paths anchored at the origin, so the probe finds the local files.
  env.localModelPath = `${import.meta.env.BASE_URL}models/`;
  return pipeline("text-generation", MODEL_ID, {
    dtype: kind,
    device: "wasm",
    progress_callback: onProgress,
  });
}

/** Kick off (or re-attach to) the download+load. Safe to call repeatedly. */
export function loadModel(kind: ModelKind, opts: { auto?: boolean } = {}): void {
  if (pipePromise && state.kind === kind) return;
  set({
    phase: "loading",
    kind,
    loaded: 0,
    total: 0,
    error: "",
    msPerToken: 0,
    auto: opts.auto ?? false,
  });
  pipePromise = buildGenerator(kind)
    .then((pipe) => {
      saveKind(kind);
      set({ phase: "ready" });
      return pipe;
    })
    .catch((e: unknown) => {
      // Swallow (a rethrow here surfaces as an unhandled rejection; the UI
      // reads `phase: "error"` instead) and null the promise so a retry
      // rebuilds from scratch.
      pipePromise = null;
      set({ phase: "error", error: e instanceof Error ? e.message : String(e) });
      return null;
    });
}

/**
 * Called when the Biri window mounts: if the user previously chose a tier
 * (localStorage) and that model is already in the browser cache, start
 * loading it so the chat is ready without the confirmation gate. Returns
 * true when an auto-load was kicked off.
 */
export async function maybeAutoLoad(): Promise<boolean> {
  if (pipePromise || state.phase === "ready" || state.phase === "loading") return false;
  const kind = loadKind();
  if (!kind) return false;
  const cached = await probeCache(kind);
  if (!cached) return false;
  loadModel(kind, { auto: true });
  return true;
}

// Character-level news topics the CKIP corpus loves; excised from output.
const SENSITIVE = [
  "國民黨",
  "民進黨",
  "共產黨",
  "中共",
  "中華民國",
  "共和國",
  "北京",
  "政府",
  "總統",
  "總理",
  "首相",
  "外交部",
  "國會",
  "議會",
  "立法",
  "憲法",
  "選舉",
  "公投",
  "獨立",
  "統一",
  "領土",
  "主權",
  "兩岸",
  "臺海",
  "台海",
  "執政",
  "在野",
  "政黨",
  "省長",
  "國務院",
];

function sanitize(text: string): string {
  let out = text.replace(/\s+/g, "");
  for (const w of SENSITIVE) out = out.split(w).join("");
  return out.trim();
}

export async function askBiri(prompt: string): Promise<string> {
  if (!pipePromise) throw new Error("model not loaded");
  const pipe = await pipePromise;
  if (!pipe) throw new Error("model failed to load");
  const t0 = performance.now();
  const out = await pipe(prompt, {
    max_new_tokens: 72,
    do_sample: true,
    temperature: 0.8,
    top_k: 40,
    return_full_text: false,
  });
  const elapsed = performance.now() - t0;
  const text: string = Array.isArray(out)
    ? (out[0]?.generated_text ?? "")
    : String(out);
  const tokens = Math.max(1, [...text].length); // ~1 char/token for zh
  set({ msPerToken: Math.round((elapsed / tokens) * 10) / 10 });
  return sanitize(text);
}

export function unloadModel(): void {
  pipePromise = null;
  set({ phase: "idle", kind: null, loaded: 0, total: 0, error: "" });
}
