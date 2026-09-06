import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { App, AppTitleBarProps } from "@benos/core";
import { useTheme } from "@benos/desktop";
import { pngIcon } from "@benos/demo";
import {
  MODEL_LABELS,
  askBiri,
  cacheVideo,
  getBiriState,
  getBoot,
  getRememberedKind,
  getSplashSrc,
  getVideoSrc,
  isDownloaded,
  isModelCached,
  isVideoCached,
  loadModel,
  setBoot,
  setSplashSrc,
  subscribeBiri,
  subscribeBoot,
  type BiriState,
  type ModelKind,
} from "./model";
import {
  appendMsg,
  createSession,
  deleteSession,
  getSessions,
  setModel,
  subscribeHistory,
  type Session,
} from "./history";

const TIERS: ModelKind[] = ["q8", "q4"];
const ICON = `${import.meta.env.BASE_URL}icon/biri.png`;
const NEWCHAT_SVG = `${import.meta.env.BASE_URL}biri-newchat.svg`;

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function activeKind(model: BiriState): ModelKind {
  return model.kind ?? getRememberedKind() ?? "q8";
}

// Line icon matching the reference's minimal chrome (hamburger).
const MenuIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  const theme = useTheme();
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        display: "grid",
        placeItems: "center",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: theme.palette.textPrimary,
        borderRadius: 8,
        opacity: 0.75,
      }}
    >
      {children}
    </button>
  );
}

// The "new chat" glyph is the user's SVG (a dark icon for light mode). It's
// painted through a CSS mask filled with textPrimary, so it flips to a light
// glyph automatically in dark mode.
function NewChatIcon() {
  const theme = useTheme();
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        display: "inline-block",
        backgroundColor: theme.palette.textPrimary,
        WebkitMaskImage: `url("${NEWCHAT_SVG}")`,
        maskImage: `url("${NEWCHAT_SVG}")`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Custom window title bar. Reads the boot store so the whole window can go
// black while the splash video plays, then return to the frosted theme. No
// title text (matches the reference's bare top strip).
// ---------------------------------------------------------------------------
function BiriTitleBar(p: AppTitleBarProps) {
  const theme = useTheme();
  const boot = useSyncExternalStore(subscribeBoot, getBoot);
  const black = boot === "video";
  const traffic = theme.chrome.windowControls === "traffic-lights";
  const windows = theme.chrome.windowControls === "windows";
  return (
    <div
      onPointerDown={p.onPointerDown}
      onPointerMove={p.onPointerMove}
      onPointerUp={p.onPointerUp}
      onPointerCancel={p.onPointerCancel}
      onDoubleClick={p.onDoubleClick}
      onContextMenu={p.onContextMenu}
      style={{
        position: "relative",
        height: p.height,
        display: "flex",
        alignItems: "center",
        justifyContent: traffic ? "flex-start" : "flex-end",
        paddingLeft: traffic ? 10 : 12,
        paddingRight: windows ? 0 : 10,
        borderBottom: black ? "none" : `1px solid ${theme.palette.border}`,
        background: black ? "#000" : "transparent",
        userSelect: "none",
        cursor: "grab",
        flexShrink: 0,
      }}
    >
      {traffic ? (
        <>
          {p.controls}
          <span style={{ flex: 1 }} aria-hidden />
        </>
      ) : (
        <>{p.controls}</>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boot: the "加载 Bpple Intelligence" gate a brand-new visitor sees.
// ---------------------------------------------------------------------------
function GateScreen({ onPick }: { onPick: (k: ModelKind) => void }) {
  const theme = useTheme();
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: 24,
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <img src={ICON} alt="" style={{ width: 56, height: 56, borderRadius: 14 }} />
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.2 }}>
        加载 Bpple Intelligence
      </div>
      <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 300 }}>
        {TIERS.map((k) => {
          const L = MODEL_LABELS[k];
          return (
            <button
              key={k}
              onClick={() => onPick(k)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                borderRadius: 14,
                border: `1px solid ${theme.palette.border}`,
                background: theme.palette.surface,
                color: theme.palette.textPrimary,
                backdropFilter: theme.blur.surface,
                WebkitBackdropFilter: theme.blur.surface,
                textAlign: "left",
              }}
            >
              <span style={{ display: "grid", gap: 2 }}>
                <span>{L.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.6 }}>
                  {L.note}
                </span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.55, fontWeight: 500 }}>
                {L.size}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boot: model download progress (new visitor, right after picking a tier).
// ---------------------------------------------------------------------------
function DownloadScreen({ model }: { model: BiriState }) {
  const theme = useTheme();
  const pct = model.total > 0 ? Math.min(1, model.loaded / model.total) : 0;
  const name = MODEL_LABELS[activeKind(model)].name;
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 28,
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 14.5, fontWeight: 600 }}>正在下载 {name}</div>
      <div
        style={{
          width: "100%",
          maxWidth: 260,
          height: 4,
          borderRadius: 2,
          background: theme.palette.border,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: theme.palette.textPrimary,
            transition: "width 0.25s",
          }}
        />
      </div>
      <div style={{ fontSize: 12, opacity: 0.6 }}>
        {pct > 0 ? `${Math.round(pct * 100)}% · ${formatMB(model.loaded)}` : "准备中…"}
      </div>
      {model.error && (
        <div style={{ fontSize: 12.5, color: "#e5484d", lineHeight: 1.5 }}>
          下载失败：{model.error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boot: the 5s splash video. The only pure-black surface in the app; the
// custom title bar paints the top strip black to match.
// ---------------------------------------------------------------------------
function VideoScreen({ src, onDone }: { src: string; onDone: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <video
        src={src}
        autoPlay
        muted
        playsInline
        onEnded={onDone}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      <button
        onClick={onDone}
        style={{
          position: "absolute",
          top: 12,
          right: 14,
          padding: "5px 12px",
          fontSize: 12,
          cursor: "pointer",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(0,0,0,0.35)",
          color: "#fff",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        跳过
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model chip: shows the active tier, opens a switcher that downloads a tier
// that isn't cached yet. Neutral (no accent fill).
// ---------------------------------------------------------------------------
function ModelChip({ model }: { model: BiriState }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [cached, setCached] = useState<Record<ModelKind, boolean>>({
    q8: false,
    q4: false,
  });
  const cur = activeKind(model);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      const [a, b] = await Promise.all([isModelCached("q8"), isModelCached("q4")]);
      if (alive) setCached({ q8: a, q4: b });
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const rowStatus = (k: ModelKind): string => {
    if (k === cur) {
      if (model.phase === "ready") return "使用中";
      if (model.phase === "loading") {
        const pct =
          model.total > 0 ? Math.round((model.loaded / model.total) * 100) : 0;
        return isDownloaded(model) ? "加载中…" : `下载中 ${pct}%`;
      }
      return "准备中…";
    }
    return cached[k] ? "切换" : `下载 ${MODEL_LABELS[k].size}`;
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 11px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          borderRadius: 999,
          border: `1px solid ${theme.palette.border}`,
          background: theme.palette.surface,
          color: theme.palette.textPrimary,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background:
              model.phase === "ready"
                ? theme.palette.textPrimary
                : theme.palette.textSecondary,
          }}
        />
        {MODEL_LABELS[cur].name}
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 5 }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              zIndex: 6,
              width: 220,
              display: "grid",
              gap: 2,
              padding: 6,
              borderRadius: 12,
              border: `1px solid ${theme.palette.border}`,
              background: theme.palette.surface,
              backdropFilter: theme.blur.spotlight,
              WebkitBackdropFilter: theme.blur.spotlight,
              boxShadow:
                theme.elevation?.windowFocused ?? "0 10px 40px rgba(0,0,0,0.28)",
            }}
          >
            {TIERS.map((k) => {
              const L = MODEL_LABELS[k];
              const isCur = k === cur && model.phase === "ready";
              return (
                <button
                  key={k}
                  disabled={isCur}
                  onClick={() => {
                    if (!isCur) loadModel(k);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "9px 10px",
                    fontSize: 12.5,
                    cursor: isCur ? "default" : "pointer",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: theme.palette.textPrimary,
                    opacity: isCur ? 0.7 : 1,
                  }}
                >
                  <span style={{ display: "grid", gap: 1, textAlign: "left" }}>
                    <span style={{ fontWeight: 600 }}>{L.name}</span>
                    <span style={{ fontSize: 11, opacity: 0.55 }}>{L.note}</span>
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                      color: theme.palette.textSecondary,
                    }}
                  >
                    {rowStatus(k)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The right pane: header (compose + model chip), messages, neutral composer.
// A fresh pane (no session) creates its session lazily on the first send.
// ---------------------------------------------------------------------------
function ChatPane({
  session,
  model,
  sidebarOpen,
  onExpandSidebar,
  onCompose,
  onCreateSession,
}: {
  session: Session | undefined;
  model: BiriState;
  sidebarOpen: boolean;
  onExpandSidebar: () => void;
  onCompose: () => void;
  onCreateSession: () => string;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const ready = model.phase === "ready";
  const msgs = session?.msgs ?? [];

  useEffect(() => {
    if (
      model.phase === "ready" &&
      model.kind &&
      session &&
      session.model !== model.kind
    ) {
      setModel(session.id, model.kind);
    }
  }, [model.phase, model.kind, session]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || !ready) return;
    setDraft("");
    const sid = session ? session.id : onCreateSession();
    appendMsg(sid, { from: "user", text });
    setBusy(true);
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: 1e9 }));
    try {
      const answer = await askBiri(text);
      appendMsg(sid, { from: "ai", text: answer || "……" });
    } catch (e) {
      appendMsg(sid, {
        from: "ai",
        text: `（生成失败：${e instanceof Error ? e.message : String(e)}）`,
      });
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scroller.current?.scrollTo({ top: 1e9 }));
    }
  };

  const bubble = (from: "user" | "ai"): React.CSSProperties => ({
    maxWidth: "72%",
    padding: "8px 12px",
    fontSize: 13.5,
    lineHeight: 1.65,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    borderRadius: from === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
    background: from === "user" ? theme.palette.textPrimary : theme.palette.surface,
    color: from === "user" ? theme.palette.surface : theme.palette.textPrimary,
    border: from === "ai" ? `1px solid ${theme.palette.border}` : "none",
    alignSelf: from === "user" ? "flex-end" : "flex-start",
  });

  const canSend = ready && !busy && draft.trim().length > 0;

  return (
    <div
      style={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "8px 12px",
          borderBottom: `1px solid ${theme.palette.border}`,
        }}
      >
        {!sidebarOpen && (
          <IconBtn label="展开侧栏" onClick={onExpandSidebar}>
            {MenuIcon}
          </IconBtn>
        )}
        <IconBtn label="新对话" onClick={onCompose}>
          <NewChatIcon />
        </IconBtn>
        <div style={{ flex: 1, minWidth: 0 }} />
        <ModelChip model={model} />
      </div>

      <div
        ref={scroller}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 16,
        }}
      >
        {msgs.length === 0 && (
          <div
            style={{
              margin: "auto",
              fontSize: 13,
              opacity: 0.5,
              textAlign: "center",
              lineHeight: 1.8,
            }}
          >
            {MODEL_LABELS[activeKind(model)].name} 已就绪
            {model.msPerToken > 0 ? ` · ${model.msPerToken} ms/字` : ""}
            <br />
            随便说点什么，比如「你好」「今天天气」
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={bubble(m.from)}>
            {m.text}
          </div>
        ))}
        {busy && <div style={bubble("ai")}>…</div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 14 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
          placeholder={ready ? "Ask Biri…" : "模型准备中…"}
          disabled={busy || !ready}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13.5,
            padding: "11px 16px",
            borderRadius: 999,
            border: `1px solid ${theme.palette.border}`,
            background: theme.palette.surface,
            color: theme.palette.textPrimary,
            outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          aria-label="发送"
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            fontSize: 17,
            borderRadius: 999,
            border: "none",
            cursor: canSend ? "pointer" : "default",
            background: canSend ? theme.palette.textPrimary : theme.palette.border,
            color: canSend ? theme.palette.surface : theme.palette.textSecondary,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The persistent left sidebar: a two-column, vertically-offset card wall of
// saved conversations (the reference's staggered layout).
// ---------------------------------------------------------------------------
function Sidebar({
  activeId,
  onSelect,
  onCollapse,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onCollapse: () => void;
}) {
  const theme = useTheme();
  const sessions = useSyncExternalStore(subscribeHistory, getSessions);
  const col0: Session[] = [];
  const col1: Session[] = [];
  sessions.forEach((s, i) => (i % 2 === 0 ? col0 : col1).push(s));

  return (
    <div
      style={{
        width: 288,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: `1px solid ${theme.palette.border}`,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 10px" }}>
        <IconBtn label="收起侧栏" onClick={onCollapse}>
          {MenuIcon}
        </IconBtn>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {sessions.length === 0 ? (
          <div
            style={{
              paddingTop: 40,
              textAlign: "center",
              opacity: 0.5,
              fontSize: 12.5,
              lineHeight: 1.7,
            }}
          >
            还没有对话
            <br />
            记录存在本地
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            {[col0, col1].map((col, c) => (
              <div
                key={c}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginTop: c === 1 ? 24 : 0,
                }}
              >
                {col.map((s) => (
                  <WallCard
                    key={s.id}
                    session={s}
                    active={s.id === activeId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WallCard({
  session,
  active,
  onSelect,
}: {
  session: Session;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const preview =
    session.msgs.find((m) => m.from === "ai")?.text ??
    session.msgs[session.msgs.length - 1]?.text ??
    "（空对话）";
  return (
    <div
      onClick={() => onSelect(session.id)}
      style={{
        padding: 12,
        borderRadius: 14,
        border: `1px solid ${active ? theme.palette.textSecondary : theme.palette.border}`,
        background: theme.palette.surface,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        cursor: "pointer",
        opacity: active ? 1 : 0.82,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {session.title}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteSession(session.id);
          }}
          aria-label="删除"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
            opacity: 0.35,
            color: theme.palette.textPrimary,
            padding: 2,
          }}
        >
          ✕
        </button>
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 11.5,
          opacity: 0.6,
          lineHeight: 1.55,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
        }}
      >
        {preview}
      </div>
      <div style={{ marginTop: 8, fontSize: 10.5, opacity: 0.45 }}>
        {MODEL_LABELS[session.model].name}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root: the boot state machine (gate → download → video → app), then the
// sidebar + chat layout. The right pane defaults to a fresh conversation.
// ---------------------------------------------------------------------------
export function BiriContent() {
  const model = useSyncExternalStore(subscribeBiri, getBiriState);
  const boot = useSyncExternalStore(subscribeBoot, getBoot);
  const sessions = useSyncExternalStore(subscribeHistory, getSessions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Decide the entry screen once: cached model → straight to the video;
  // otherwise → the download gate. Guarded so a minimize (which unmounts the
  // window content) and later restore does NOT replay the splash — boot lives
  // in the module store and has already advanced past "boot".
  useEffect(() => {
    if (getBoot() !== "boot") return;
    let alive = true;
    void (async () => {
      const kind = getRememberedKind();
      if (kind && (await isModelCached(kind))) {
        if (!(await isVideoCached())) await cacheVideo();
        const src = await getVideoSrc();
        if (!alive) return;
        setSplashSrc(src);
        loadModel(kind); // warm the model from cache during the video
        setBoot("video");
      } else if (alive) {
        setBoot("gate");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // A new visitor's download finished → cache the video and roll the splash.
  // A cached model may skip progress events and jump straight to "ready", so
  // treat that as done too.
  useEffect(() => {
    if (boot !== "download") return;
    const done =
      (model.total > 0 && model.loaded >= model.total) || model.phase === "ready";
    if (!done) return;
    let alive = true;
    void (async () => {
      await cacheVideo();
      const src = await getVideoSrc();
      if (!alive) return;
      setSplashSrc(src);
      setBoot("video");
    })();
    return () => {
      alive = false;
    };
  }, [boot, model.loaded, model.total, model.phase]);

  const session = activeId ? sessions.find((s) => s.id === activeId) : undefined;

  let body: React.ReactNode;
  if (boot === "gate")
    body = (
      <GateScreen
        onPick={(k) => {
          loadModel(k);
          void cacheVideo(); // cache the splash alongside the model download
          setBoot("download");
        }}
      />
    );
  else if (boot === "download") body = <DownloadScreen model={model} />;
  else if (boot === "video")
    body = (
      <VideoScreen
        src={getSplashSrc()}
        onDone={() => {
          const src = getSplashSrc();
          if (src.startsWith("blob:")) URL.revokeObjectURL(src);
          setSplashSrc("");
          setBoot("app");
        }}
      />
    );
  else if (boot === "app")
    body = (
      <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
        {sidebarOpen && (
          <Sidebar
            activeId={activeId}
            onSelect={setActiveId}
            onCollapse={() => setSidebarOpen(false)}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <ChatPane
            session={session}
            model={model}
            sidebarOpen={sidebarOpen}
            onExpandSidebar={() => setSidebarOpen(true)}
            onCompose={() => setActiveId(null)}
            onCreateSession={() => {
              const s = createSession(activeKind(model));
              setActiveId(s.id);
              return s.id;
            }}
          />
        </div>
      </div>
    );
  else body = null; // "boot": probing, render nothing to avoid a gate flash

  // During the video, bleed past the window's 16px content padding so the
  // black reaches the frame edges (the custom title bar paints the top strip).
  const bleed = boot === "video";
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        ...(bleed
          ? {
              margin: -16,
              width: "calc(100% + 32px)",
              height: "calc(100% + 32px)",
              background: "#000",
            }
          : {}),
      }}
    >
      {body}
    </div>
  );
}

export const biriApp: App = {
  id: "biri",
  name: "Biri",
  tagline: "会胡说八道的浏览器小模型",
  accent: "#8f7bff",
  icon: pngIcon(ICON),
  iconFormat: "macgrid",
  defaultBounds: { w: 920, h: 620 },
  content: BiriContent,
  chrome: { titleBar: BiriTitleBar },
};
