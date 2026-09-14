import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTheme } from "@benos/desktop";
import { CATALOG, type CatalogImage } from "./data/catalog";
import { DISTROS, ABOUT, type Distro } from "./data/distros";
import { download, getLinuxState, refreshCache, remove, subscribeLinux } from "./store";

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

type Tab = "recommended" | "all" | "about";

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const second = parts[1];
  if (!second) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + second.charAt(0)).toUpperCase();
}

function Monogram({
  label,
  color,
  size,
}: {
  label: string;
  color: string;
  size: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: Math.round(size * 0.28),
        background: color,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        letterSpacing: 0.5,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)",
      }}
    >
      {label}
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        lineHeight: "16px",
        padding: "1px 8px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

interface StatusTone {
  label: string;
  color: string;
}

function useStatus(distro: Distro): StatusTone {
  const state = useSyncExternalStore(subscribeLinux, getLinuxState);
  const accent = useTheme().palette.accent;
  if (!distro.boot) return { label: "待支持", color: "#8a8a93" };
  const progress = state.progress[distro.id];
  if (progress) {
    const pct =
      progress.total > 0
        ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
        : 0;
    return { label: `下载中 ${String(pct)}%`, color: accent };
  }
  if (state.cached.includes(distro.id)) return { label: "已下载", color: "#2f9e6f" };
  if (state.errors[distro.id]) return { label: "下载失败", color: "#d65745" };
  return { label: "未下载", color: "#8a8a93" };
}

/* ── recommended card ───────────────────────────────────────── */

function DistroCard({ distro, onOpen }: { distro: Distro; onOpen: () => void }) {
  const theme = useTheme();
  const status = useStatus(distro);
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        appearance: "none",
        textAlign: "left",
        font: "inherit",
        color: theme.palette.textPrimary,
        background: theme.palette.surface,
        border: `1px solid ${theme.palette.border}`,
        borderRadius: 14,
        padding: 14,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        cursor: "pointer",
        minWidth: 0,
      }}
    >
      <Monogram label={initials(distro.name)} color={distro.color} size={44} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{distro.name}</div>
        <div
          style={{
            fontSize: 12,
            color: theme.palette.textSecondary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {distro.tagline}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
          <Pill color={theme.palette.border}>{distro.size}</Pill>
          <Pill color={status.color}>{status.label}</Pill>
        </div>
      </div>
    </button>
  );
}

/* ── distro detail ──────────────────────────────────────────── */

function DistroDetail({ distro, onBack }: { distro: Distro; onBack: () => void }) {
  const theme = useTheme();
  const state = useSyncExternalStore(subscribeLinux, getLinuxState);
  const status = useStatus(distro);
  const progress = state.progress[distro.id];
  const cached = state.cached.includes(distro.id);
  const error = state.errors[distro.id];
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
      : 0;

  const button: React.CSSProperties = {
    appearance: "none",
    font: "inherit",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 16px",
    borderRadius: 9,
    cursor: "pointer",
    border: `1px solid ${theme.palette.border}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          ...button,
          alignSelf: "flex-start",
          background: "transparent",
          color: theme.palette.textSecondary,
          border: 0,
          padding: "2px 0",
        }}
      >
        ← 返回
      </button>

      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Monogram label={initials(distro.name)} color={distro.color} size={72} />
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{distro.name}</h2>
          <div
            style={{ fontSize: 13, color: theme.palette.textSecondary, marginTop: 4 }}
          >
            {distro.tagline} · {distro.size}
          </div>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.65,
          color: theme.palette.textPrimary,
        }}
      >
        {distro.intro}
      </p>

      {distro.note && (
        <div style={{ fontSize: 12, color: theme.palette.textSecondary }}>
          上游备注：{distro.note}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 16,
          borderRadius: 14,
          background: theme.palette.surface,
          border: `1px solid ${theme.palette.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Pill color={status.color}>{status.label}</Pill>
          {!distro.boot && (
            <span style={{ fontSize: 12, color: theme.palette.textSecondary }}>
              {distro.pending}
            </span>
          )}
        </div>

        {progress && (
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: theme.palette.border,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${String(pct)}%`,
                height: "100%",
                background: theme.palette.accent,
                transition: "width .15s linear",
              }}
            />
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: "#d65745" }}>下载失败：{error}</div>
        )}

        {distro.boot && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {!cached && !progress && (
              <button
                type="button"
                onClick={() => {
                  void download(distro.id);
                }}
                style={{
                  ...button,
                  border: 0,
                  background: theme.palette.accent,
                  color: "#fff",
                }}
              >
                {error ? "重试下载" : `下载 · ${distro.size}`}
              </button>
            )}
            {cached && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void remove(distro.id);
                  }}
                  style={{
                    ...button,
                    background: "transparent",
                    color: theme.palette.textPrimary,
                  }}
                >
                  删除本地镜像
                </button>
                <span style={{ fontSize: 12, color: theme.palette.textSecondary }}>
                  在 Ghostty 里运行{" "}
                  <code style={{ fontFamily: "monospace" }}>
                    linux boot {distro.id}
                  </code>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── full catalog ───────────────────────────────────────────── */

function CatalogRow({ entry }: { entry: CatalogImage }) {
  const theme = useTheme();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "10px 4px",
        borderBottom: `1px solid ${theme.palette.border}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{entry.name}</div>
        <div
          style={{
            fontSize: 11.5,
            color: theme.palette.textSecondary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.notes || entry.id}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        <Pill color={theme.palette.border}>{entry.family}</Pill>
        <Pill color={theme.palette.border}>{entry.ui === "tui" ? "文本" : "图形"}</Pill>
        <Pill color={theme.palette.border}>{entry.medium}</Pill>
        <span
          style={{
            fontSize: 11.5,
            color: theme.palette.textSecondary,
            width: 56,
            textAlign: "right",
          }}
        >
          {entry.size}
        </span>
      </div>
    </div>
  );
}

function CatalogTab() {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("全部");
  const [ui, setUi] = useState<"全部" | "文本" | "图形">("全部");

  const families = useMemo(
    () => ["全部", ...Array.from(new Set(CATALOG.map((e) => e.family)))],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter((entry) => {
      if (family !== "全部" && entry.family !== family) return false;
      if (ui === "文本" && entry.ui !== "tui") return false;
      if (ui === "图形" && entry.ui !== "gui") return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.id.toLowerCase().includes(q) ||
        entry.notes.toLowerCase().includes(q)
      );
    });
  }, [query, family, ui]);

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        font: "inherit",
        fontSize: 12,
        padding: "4px 11px",
        borderRadius: 999,
        cursor: "pointer",
        border: `1px solid ${active ? theme.palette.accent : theme.palette.border}`,
        background: active ? theme.palette.accent : "transparent",
        color: active ? "#fff" : theme.palette.textSecondary,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索发行版"
        style={{
          font: "inherit",
          fontSize: 13,
          padding: "8px 12px",
          borderRadius: 10,
          border: `1px solid ${theme.palette.border}`,
          background: theme.palette.surface,
          color: theme.palette.textPrimary,
          outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {families.map((f) => chip(f, family === f, () => setFamily(f)))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["全部", "文本", "图形"] as const).map((u) =>
          chip(u, ui === u, () => setUi(u)),
        )}
      </div>
      <div style={{ fontSize: 11.5, color: theme.palette.textSecondary }}>
        {filtered.length} / {CATALOG.length} 个镜像 · 来自 copy.sh/v86 的镜像表
      </div>
      <div>
        {filtered.map((entry) => (
          <CatalogRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

/* ── about ──────────────────────────────────────────────────── */

function AboutTab() {
  const theme = useTheme();
  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>
      {ABOUT.map((paragraph, index) => (
        <p
          key={index}
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.7,
            color: theme.palette.textPrimary,
          }}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

/* ── app ────────────────────────────────────────────────────── */

export function LinuxContent() {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>("recommended");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void refreshCache();
  }, []);

  const selectedDistro = selected ? DISTROS.find((d) => d.id === selected) : undefined;

  const tabs: { id: Tab; label: string }[] = [
    { id: "recommended", label: "推荐" },
    { id: "all", label: "全部镜像" },
    { id: "about", label: "关于" },
  ];

  return (
    <div
      style={{
        margin: -16,
        width: "calc(100% + 32px)",
        height: "calc(100% + 32px)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: theme.palette.background,
        color: theme.palette.textPrimary,
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "18px 22px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Linux</h1>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {tabs.map((entry) => {
            const active = tab === entry.id && !selectedDistro;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setSelected(null);
                  setTab(entry.id);
                }}
                style={{
                  appearance: "none",
                  font: "inherit",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  padding: "6px 14px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: 0,
                  background: active ? theme.palette.surface : "transparent",
                  color: active
                    ? theme.palette.textPrimary
                    : theme.palette.textSecondary,
                }}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "18px 22px 24px" }}
      >
        {selectedDistro ? (
          <DistroDetail distro={selectedDistro} onBack={() => setSelected(null)} />
        ) : tab === "recommended" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: 14,
            }}
          >
            {DISTROS.map((distro) => (
              <DistroCard
                key={distro.id}
                distro={distro}
                onOpen={() => setSelected(distro.id)}
              />
            ))}
          </div>
        ) : tab === "all" ? (
          <CatalogTab />
        ) : (
          <AboutTab />
        )}
      </div>
    </div>
  );
}
