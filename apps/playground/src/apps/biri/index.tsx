import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { App } from "@benos/core";
import { useTheme } from "@benos/desktop";
import { pngIcon } from "@benos/demo";
import {
  MODEL_LABELS,
  askBiri,
  getBiriState,
  loadModel,
  maybeAutoLoad,
  subscribeBiri,
  type ModelKind,
} from "./model";

interface Msg {
  from: "user" | "ai";
  text: string;
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Gate({ kind, pct, error }: { kind: ModelKind | null; pct: number; error: string }) {
  const theme = useTheme();
  const pick = (k: ModelKind) => loadModel(k);
  const loading = kind !== null;
  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 380, margin: "0 auto", padding: "8px 4px" }}>
      {!loading && (
        <>
          <div style={{ fontSize: 15, fontWeight: 600 }}>把模型下载到浏览器里</div>
          <div style={{ fontSize: 12.5, opacity: 0.75, lineHeight: 1.6 }}>
            Biri 的推理完全在本地进行。首次需要下载一次，之后存在浏览器缓存里；
            下载中途关掉窗口也会继续。
          </div>
        </>
      )}
      {(["q8", "q4"] as ModelKind[]).map((k) => {
        const L = MODEL_LABELS[k];
        const active = kind === k;
        return (
          <button
            key={k}
            onClick={() => !active && pick(k)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "11px 13px",
              fontSize: 13.5,
              cursor: active ? "default" : "pointer",
              borderRadius: 10,
              border: `1px solid ${active ? theme.palette.accent : theme.palette.border}`,
              background: theme.palette.surface,
              color: theme.palette.textPrimary,
            }}
          >
            <span>
              {L.name} <span style={{ opacity: 0.6, fontSize: 12 }}>· {L.note}</span>
            </span>
            {active ? (
              <span style={{ fontSize: 12, opacity: 0.75 }}>{Math.round(pct * 100)}%</span>
            ) : (
              <span style={{ fontSize: 12, opacity: 0.55 }}>{L.size}</span>
            )}
          </button>
        );
      })}
      {kind && (
        <div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: theme.palette.border,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, pct * 100)}%`,
                height: "100%",
                background: theme.palette.accent,
                transition: "width 0.25s",
              }}
            />
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 6 }}>
            {pct > 0 && pct < 1 ? `下载中 ${formatMB(getBiriState().loaded)}` : "准备中…"}
          </div>
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12.5, color: "#e5484d", lineHeight: 1.5 }}>加载失败：{error}</div>
      )}
    </div>
  );
}

export function BiriContent() {
  const theme = useTheme();
  const state = useSyncExternalStore(subscribeBiri, getBiriState);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // When the window opens: if the user already chose a tier and it's cached,
  // load it straight away (no confirmation gate, no re-download).
  useEffect(() => {
    void maybeAutoLoad();
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || state.phase !== "ready") return;
    setDraft("");
    setMsgs((m) => [...m, { from: "user", text }]);
    setBusy(true);
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: 1e9 }));
    try {
      const answer = await askBiri(text);
      setMsgs((m) => [...m, { from: "ai", text: answer || "……" }]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { from: "ai", text: `（生成失败：${e instanceof Error ? e.message : String(e)}）` },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scroller.current?.scrollTo({ top: 1e9 }));
    }
  };

  const bubble = (m: Msg): React.CSSProperties => ({
    maxWidth: "82%",
    padding: "8px 12px",
    fontSize: 13.5,
    lineHeight: 1.65,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    borderRadius: m.from === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
    background: m.from === "user" ? theme.palette.accent : theme.palette.surface,
    color: m.from === "user" ? "#fff" : theme.palette.textPrimary,
    border: m.from === "ai" ? `1px solid ${theme.palette.border}` : "none",
    alignSelf: m.from === "user" ? "flex-end" : "flex-start",
  });

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 14,
        gap: 10,
        boxSizing: "border-box",
      }}
    >
      {state.phase === "ready" ? (
        <>
          <div ref={scroller} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {msgs.length === 0 && (
              <div style={{ margin: "auto", fontSize: 12.5, opacity: 0.55, textAlign: "center" }}>
                {MODEL_LABELS[state.kind ?? "q8"].name}已就绪
                {state.msPerToken > 0 ? ` · ${state.msPerToken} ms/字` : ""}
                <br />
                随便说点什么，比如「你好」「今天天气」
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={bubble(m)}>
                {m.text}
              </div>
            ))}
            {busy && <div style={bubble({ from: "ai", text: "" })}>…</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
              placeholder="说点什么…"
              disabled={busy}
              style={{
                flex: 1,
                fontSize: 13.5,
                padding: "9px 12px",
                borderRadius: 9,
                border: `1px solid ${theme.palette.border}`,
                background: theme.palette.surface,
                color: theme.palette.textPrimary,
                outline: "none",
              }}
            />
            <button
              onClick={send}
              disabled={busy || !draft.trim()}
              style={{
                padding: "0 16px",
                fontSize: 13,
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                background: theme.palette.accent,
                color: "#fff",
                opacity: busy || !draft.trim() ? 0.5 : 1,
              }}
            >
              发送
            </button>
          </div>
        </>
      ) : state.auto ? (
        // Silent cache-hit load: no gate, no progress bar. Just wait for the
        // model to be ready, then the chat UI renders in full.
        <div style={{ flex: 1, display: "grid", placeItems: "center", opacity: 0.5 }}>
          <div style={{ fontSize: 12.5 }}>正在加载模型…</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
          <Gate
            kind={state.kind}
            pct={state.total > 0 ? state.loaded / state.total : 0}
            error={state.error}
          />
        </div>
      )}
    </div>
  );
}

export const biriApp: App = {
  id: "biri",
  name: "Biri",
  tagline: "会胡说八道的浏览器小模型",
  accent: "#8f7bff",
  icon: pngIcon(`${import.meta.env.BASE_URL}icon/biri.png`),
  iconFormat: "macgrid",
  defaultBounds: { w: 460, h: 620 },
  content: BiriContent,
};
