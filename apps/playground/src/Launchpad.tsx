import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useWindowManager, windowIdOf } from "@benos/core";
import { AppIconTile, useApps, useDesktopContext, useTheme } from "@benos/desktop";

const TILE = 104;
const LABEL_W = TILE + 28;
const COLUMNS = 5;
const ROWS = 4;
const GAP = 36;
const PAGE_SIZE = COLUMNS * ROWS;

/**
 * The classic Launchpad (macOS 10.7 through Monterey): a full-screen blurred
 * grid of every app, 7x5 per page with dot pagination and arrow-key paging,
 * opened from its own dock tile, closed by Escape, a click on empty space, or
 * launching an app. Order comes from `layout.allApps` (backend-controlled);
 * unlisted apps trail in registration order.
 */
export function LaunchpadContent() {
  const theme = useTheme();
  const apps = useApps();
  const { layout } = useDesktopContext();
  const { openWindow, closeWindow } = useWindowManager();
  const ownId = windowIdOf({ kind: "app", appId: "launchpad" });
  const [page, setPage] = useState(0);

  const order = layout?.allApps ?? [];
  const rank = new Map(order.map((id, i) => [id, i]));
  const visible = apps
    .filter((a) => a.id !== "launchpad")
    .sort(
      (a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length),
    );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeWindow(ownId);
      } else if (e.key === "ArrowRight") {
        e.stopPropagation();
        setPage((p) => Math.min(p + 1, pages - 1));
      } else if (e.key === "ArrowLeft") {
        e.stopPropagation();
        setPage((p) => Math.max(p - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [closeWindow, ownId, pages]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) closeWindow(ownId);
      }}
      onWheel={(e) => {
        // macOS Launchpad pages on scroll in any direction (trackpad swipe
        // and mouse wheel alike); take the dominant axis.
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(d) < 8) return;
        setPage((p) => (d > 0 ? Math.min(p + 1, pages - 1) : Math.max(p - 1, 0)));
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        background: `${theme.palette.background}99`,
        backdropFilter: theme.blur.spotlight,
        WebkitBackdropFilter: theme.blur.spotlight,
      }}
    >
      {/* Fixed full-page width: a partially filled page keeps the grid's
          slots and flows from the left, like the real Launchpad, instead of
          the lone row centering itself. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${String(COLUMNS)}, ${String(LABEL_W)}px)`,
          gap: GAP,
          boxSizing: "border-box",
        }}
      >
        {visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => {
              openWindow({ kind: "app", appId: app.id });
              closeWindow(ownId);
            }}
            style={{
              appearance: "none",
              border: 0,
              background: "transparent",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <AppIconTile
              app={
                app.iconFormat
                  ? app
                  : { ...app, iconFormat: "image" as const, icon: app.icon }
              }
              size={TILE}
            />
            <span
              style={{
                fontSize: 13,
                color: "#fff",
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                maxWidth: LABEL_W,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {app.name}
            </span>
          </button>
        ))}
      </div>
      {pages > 1 && (
        <div style={{ display: "flex", gap: 10 }} role="tablist" aria-label="Pages">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Page ${String(i + 1)}`}
              onClick={() => setPage(i)}
              style={{
                appearance: "none",
                border: 0,
                padding: 0,
                width: 8,
                height: 8,
                borderRadius: 4,
                background: i === current ? "#fff" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
