"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FolderDef } from "@benos/core";
import { useWindowManager } from "@benos/core";
import { AppIconTile } from "./AppIconTile";
import { useApps, useDesktopContext, useTheme } from "./desktop-context";
import {
  closeFolderPopover,
  getFolderPopover,
  subscribeFolderPopover,
  toggleFolderPopover,
} from "./folder-popover-store";

/** Tile click handler shared by the dock and the desktop shortcut. */
export function folderPopoverForElement(
  folderId: string,
  el: HTMLElement | null,
): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  toggleFolderPopover({
    folderId,
    anchor: { left: r.left, top: r.top, width: r.width, height: r.height },
  });
}

const PANEL_CELL = 76;
const PANEL_PAD = 14;
const PANEL_COLS = 4;

/**
 * The iOS folder tile art: a neutral translucent squircle holding up to four
 * member icons in a 2x2 mini grid. Shared by the dock tile, the desktop
 * shortcut, and the popover's own headerless rows.
 */
export function FolderTileArt({ folder, size }: { folder: FolderDef; size: number }) {
  const theme = useTheme();
  const apps = useApps();
  const members = folder.apps
    .map((id) => apps.find((a) => a.id === id))
    .filter((a) => a !== undefined)
    .slice(0, 4);
  const inner = Math.round(size * 0.34);
  const gap = Math.max(2, Math.round(size * 0.06));
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: theme.shape.dockTileRadius,
        background: theme.palette.surface,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        display: "grid",
        gridTemplateColumns: `repeat(2, ${String(inner)}px)`,
        gridTemplateRows: `repeat(2, ${String(inner)}px)`,
        gap,
        placeContent: "center",
        boxSizing: "border-box",
      }}
    >
      {members.map((app) => (
        <AppIconTile key={app.id} app={app} size={inner} shadow={false} />
      ))}
    </span>
  );
}

/**
 * The folder popover: a small grid of member apps anchored above (or below,
 * when clipped) the tile that opened it. iOS's treatment, not Launchpad's
 * full screen. Clicking a member opens its window and closes the sheet;
 * Escape or any outside pointer-down closes it.
 */
export function FolderPopover() {
  const theme = useTheme();
  const apps = useApps();
  const { layout } = useDesktopContext();
  const { state, openWindow } = useWindowManager();
  const request = useSyncExternalStore(
    subscribeFolderPopover,
    getFolderPopover,
    () => null,
  );
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  const folder = request
    ? (layout?.folders?.find((f) => f.id === request.folderId) ?? null)
    : null;

  useEffect(() => {
    if (!request) return undefined;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(raf);
  }, [request]);

  useEffect(() => {
    if (!request) {
      setShown(false);
      return undefined;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeFolderPopover();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (panel && !panel.contains(e.target as HTMLElement)) closeFolderPopover();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [request]);

  if (!request || !folder) return null;

  const members = folder.apps
    .map((id) => apps.find((a) => a.id === id))
    .filter((a) => a !== undefined);
  if (members.length === 0) return null;

  const cols = Math.min(PANEL_COLS, members.length);
  const rows = Math.ceil(members.length / cols);
  const panelW = cols * PANEL_CELL + PANEL_PAD * 2;
  const panelH = rows * (PANEL_CELL + 8) + PANEL_PAD * 2;
  const vw = typeof window === "undefined" ? panelW * 2 : window.innerWidth;
  const vh = typeof window === "undefined" ? panelH * 2 : window.innerHeight;
  let left = request.anchor.left + request.anchor.width / 2 - panelW / 2;
  left = Math.max(8, Math.min(left, vw - panelW - 8));
  let top = request.anchor.top - panelH - 10;
  if (top < 8)
    top = Math.min(request.anchor.top + request.anchor.height + 10, vh - panelH - 8);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={folder.name}
      style={{
        position: "fixed",
        left,
        top,
        width: panelW,
        padding: PANEL_PAD,
        display: "grid",
        gridTemplateColumns: `repeat(${String(cols)}, ${String(PANEL_CELL)}px)`,
        gap: 8,
        borderRadius: theme.shape.dockTileRadius,
        background: theme.palette.surface,
        backdropFilter: theme.blur.spotlight,
        WebkitBackdropFilter: theme.blur.spotlight,
        border: `1px solid ${theme.palette.border}`,
        boxShadow:
          theme.elevation?.windowUnfocused ?? "0 18px 40px -18px rgba(0,0,0,0.45)",
        zIndex: 1300,
        opacity: shown ? 1 : 0,
        transform: shown ? "scale(1)" : "scale(0.94)",
        transformOrigin: top > request.anchor.top ? "center top" : "center bottom",
        transition: `opacity ${String(theme.motion.contextMenuDurationMs ?? 120)}ms ease, transform ${String(theme.motion.contextMenuDurationMs ?? 120)}ms ease`,
      }}
    >
      {members.map((app) => {
        const payload = { kind: "app" as const, appId: app.id };
        return (
          <button
            key={app.id}
            type="button"
            onClick={() => {
              openWindow(payload);
              closeFolderPopover();
            }}
            style={{
              appearance: "none",
              border: 0,
              background: "transparent",
              width: PANEL_CELL,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              color: theme.palette.textPrimary,
              fontFamily: "inherit",
              borderRadius: theme.shape.small,
            }}
          >
            <AppIconTile app={app} size={48} shadow={false} />
            <span
              style={{
                fontSize: 11,
                maxWidth: PANEL_CELL,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {app.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
