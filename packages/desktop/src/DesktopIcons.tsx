"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  App,
  FolderDef,
  LayoutConfig,
  StorageAdapter,
  WindowPayload,
} from "@benos/core";
import { useWindowManager } from "@benos/core";
import { AppIconTile } from "./AppIconTile";
import { openContextMenu } from "./context-menu";
import { useApps, useDesktopContext, useTheme } from "./desktop-context";
import { FolderTileArt, folderPopoverForElement } from "./FolderPopover";
import { FolderSvg } from "./folder-svg";
import {
  getSystemWindow,
  listSystemWindows,
  resolveSystemWindowName,
  type SystemWindowDef,
} from "./system-windows";
import { useDesktopMarquee } from "./use-desktop-marquee";
import { resolveAppIcon } from "./util/app-icon";
import { nextIconIndex } from "./util/desktop-icon-nav";
import { nextCascadeIndex, pickInitialBounds } from "./util/initial-bounds";
import { getChromeMetrics, getDockReservation } from "./util/layout";
import { useViewportMode } from "./util/viewport-mode";

/** One rendered desktop shortcut: an app, a system window, or a folder. */
interface DesktopIconEntry {
  key: string;
  name: string;
  /** Null for folder entries: a folder opens the popover, it has no window. */
  payload: WindowPayload | null;
  app?: App;
  def?: SystemWindowDef;
  folder?: FolderDef;
}

function predicatePasses(def: SystemWindowDef, storage: StorageAdapter): boolean {
  const cond = def.appearsAsDesktopIcon;
  if (cond === undefined || cond === false) return false;
  if (cond === true) return true;
  try {
    return cond(storage);
  } catch {
    return false;
  }
}

/**
 * Desktop entries. Without `layout.desktop` the default holds: every system
 * window whose `appearsAsDesktopIcon` predicate passes (the state-earned
 * folders). With it, the configured list drives content and order: apps
 * always show, listed system windows show unless a state-earned predicate
 * says otherwise, unknown ids (and folders until P3) are skipped.
 */
function computeDesktopIcons(
  apps: App[],
  layout: LayoutConfig | null,
  storage: StorageAdapter,
): DesktopIconEntry[] {
  if (!layout?.desktop) {
    return listSystemWindows()
      .filter((entry) => predicatePasses(entry, storage))
      .map(({ systemId, ...def }) => ({
        key: `system:${systemId}`,
        name: resolveSystemWindowName(def),
        payload: { kind: "system" as const, systemId },
        def: def as SystemWindowDef,
      }));
  }
  const out: DesktopIconEntry[] = [];
  for (const id of layout.desktop) {
    const folder = layout.folders?.find((f) => f.id === id);
    if (folder) {
      out.push({
        key: `folder:${id}`,
        name: folder.name,
        payload: null,
        folder,
      });
      continue;
    }
    const app = apps.find((a) => a.id === id);
    if (app) {
      out.push({
        key: `app:${id}`,
        name: app.name,
        payload: { kind: "app", appId: id },
        app,
      });
      continue;
    }
    const def = getSystemWindow(id);
    if (def) {
      // A listed system window shows by default; only state-earned (function)
      // predicates can veto it (empty Recents stays invisible).
      const show =
        typeof def.appearsAsDesktopIcon === "function"
          ? predicatePasses(def, storage)
          : true;
      if (show) {
        out.push({
          key: `system:${id}`,
          name: resolveSystemWindowName(def),
          payload: { kind: "system", systemId: id },
          def,
        });
      }
    }
  }
  return out;
}

const ICON_TILE = 56;
const ICON_LABEL_GAP = 4;
const ICON_GAP = 18;
const EDGE_INSET = 14;

/** Stable DOM id per option, used for the listbox `aria-activedescendant`. */
function optionDomId(systemId: string): string {
  return `rui-desktop-icon-${systemId}`;
}

/**
 * Right-edge column of file-style desktop shortcuts plus the desktop's
 * rubber-band marquee. Renders one icon per system window whose
 * `appearsAsDesktopIcon` evaluates to true. Predicates are re-checked whenever
 * the storage adapter fires a change event, so a Downloads or Presets folder
 * appears the moment the user creates the first item and disappears when they
 * delete the last one.
 *
 * Interaction mirrors the macOS desktop, matching the selection model the
 * `FileExplorer` already implements:
 *
 *  - single click selects an icon; Cmd/Ctrl click toggles; Shift click extends
 *  - double click (or Enter on the active icon) opens it
 *  - a left drag on the bare desktop sweeps a marquee that selects the icons
 *    it covers; a click on bare desktop, or Escape, clears the selection
 *  - ArrowUp / ArrowDown move the selection; Home / End jump to first / last;
 *    Cmd/Ctrl+A selects every icon
 *
 * The column is a WAI-ARIA multi-select listbox driven by
 * `aria-activedescendant`, so the whole column is a single tab stop and
 * assistive tech announces the active icon. The component always mounts (even
 * with no icons) so the marquee works on an empty desktop.
 */
export function DesktopIcons() {
  const theme = useTheme();
  const apps = useApps();
  const { storage, layout } = useDesktopContext();
  const { state, openWindow } = useWindowManager();
  const [visible, setVisible] = useState<DesktopIconEntry[]>(() =>
    computeDesktopIcons(apps, layout, storage),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const recompute = () => {
      setVisible(computeDesktopIcons(apps, layout, storage));
    };
    recompute();
    const unsubscribe = storage.subscribe(() => {
      recompute();
    });
    return unsubscribe;
  }, [apps, layout, storage]);

  // Drop selection / active ids whose icon disappeared (e.g. the last item was
  // deleted from a state-earned folder, so the predicate flips to false).
  useEffect(() => {
    const ids = new Set(visible.map((v) => v.key));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
    setActiveId((prev) => (prev && ids.has(prev) ? prev : null));
  }, [visible]);

  const selectIcons = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    setActiveId(ids.length > 0 ? (ids[ids.length - 1] ?? null) : null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setActiveId(null);
  }, []);

  // Bare-desktop pointer behavior: left-drag marquee, click-to-clear, and
  // click-a-window-to-clear all live in this one hook.
  const marquee = useDesktopMarquee({
    containerRef: listboxRef,
    selectedIds,
    selectIcons,
    clearSelection,
  });

  const openIcon = useCallback(
    (payload: WindowPayload) => {
      openWindow(
        payload,
        pickInitialBounds(payload, theme, apps, undefined, nextCascadeIndex(state)),
      );
    },
    [openWindow, theme, apps, state],
  );

  const openEntry = useCallback(
    (entry: DesktopIconEntry) => {
      if (entry.folder) {
        if (typeof document === "undefined") return;
        folderPopoverForElement(
          entry.folder.id,
          document.querySelector<HTMLElement>(`[data-desktop-icon-id="${entry.key}"]`),
        );
        return;
      }
      if (entry.payload) openIcon(entry.payload);
    },
    [openIcon],
  );

  const selectIcon = useCallback(
    (systemId: string, modifiers: { toggle?: boolean; range?: boolean }) => {
      if (modifiers.range && activeId) {
        const ids = visible.map((v) => v.key);
        const a = ids.indexOf(activeId);
        const b = ids.indexOf(systemId);
        if (a >= 0 && b >= 0) {
          const [from, to] = a <= b ? [a, b] : [b, a];
          const next = new Set<string>();
          for (let i = from; i <= to; i++) {
            const id = ids[i];
            if (id) next.add(id);
          }
          setSelectedIds(next);
          return;
        }
      }
      if (modifiers.toggle) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(systemId)) next.delete(systemId);
          else next.add(systemId);
          return next;
        });
        setActiveId(systemId);
        return;
      }
      setSelectedIds(new Set([systemId]));
      setActiveId(systemId);
    },
    [activeId, visible],
  );

  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  // Windows-style packing: the column starts at the top-left and flows down,
  // wrapping into the next column to the right when it fills. Icons clear the
  // menu bar and any dock edge they hug.
  const dock = getDockReservation(theme);
  const topInset =
    (theme.chrome.menuBar === "top" ? metrics.menuBarHeight : 0) +
    dock.top +
    EDGE_INSET;
  const leftInset = dock.left + EDGE_INSET;
  const bottomInset = dock.bottom + EDGE_INSET + 8;

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (visible.length === 0) return;
    const ids = visible.map((v) => v.key);
    // Cmd/Ctrl+A selects every icon.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selectIcons(ids);
      return;
    }
    const currentIdx = activeId ? ids.indexOf(activeId) : -1;
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Home" ||
      e.key === "End"
    ) {
      e.preventDefault();
      const next = nextIconIndex(currentIdx, e.key, ids.length);
      const id = ids[next];
      selectIcons(id ? [id] : []);
      return;
    }
    if (e.key === "Enter") {
      // macOS maps Return to rename and Cmd-Down to open, but these are
      // non-renameable system-window aliases and the FileExplorer already
      // binds Enter to open, so we follow that idiom.
      const active = visible.find((v) => v.key === activeId);
      if (active) {
        e.preventDefault();
        openEntry(active);
      }
      return;
    }
    if (e.key === "Escape" && selectedIds.size > 0) {
      e.preventDefault();
      clearSelection();
    }
  };

  return (
    <>
      {visible.length > 0 && (
        <div
          ref={listboxRef}
          role="listbox"
          aria-label="Desktop icons"
          aria-orientation="vertical"
          aria-multiselectable
          aria-activedescendant={activeId ? optionDomId(activeId) : undefined}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{
            position: "fixed",
            top: topInset,
            left: leftInset,
            display: "flex",
            flexDirection: "column",
            flexWrap: "wrap",
            alignContent: "flex-start",
            gap: ICON_GAP,
            // The wrap height is what turns overflow into a new column to the
            // right (Windows' auto-arrange grid).
            maxHeight: `calc(100vh - ${String(topInset + bottomInset)}px)`,
            zIndex: 1,
            outline: "none",
          }}
        >
          {visible.map((entry) => (
            <DesktopShortcut
              key={entry.key}
              entry={entry}
              selected={selectedIds.has(entry.key)}
              onSelect={(modifiers) => {
                selectIcon(entry.key, modifiers);
                // Move focus to the listbox so the keyboard model and
                // aria-activedescendant announcement take effect.
                listboxRef.current?.focus();
              }}
              onOpen={() => {
                openEntry(entry);
              }}
              onContextMenu={(x, y) => {
                if (!selectedIds.has(entry.key)) selectIcon(entry.key, {});
                listboxRef.current?.focus();
                openContextMenu({
                  x,
                  y,
                  ariaLabel: entry.name,
                  items: [
                    {
                      label: "Open",
                      shortcut: "↵",
                      onSelect: () => {
                        openEntry(entry);
                      },
                    },
                  ],
                  returnFocusTo: listboxRef.current,
                });
              }}
            />
          ))}
        </div>
      )}
      {marquee && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
            // Functional selection affordance, matched to the snap preview:
            // an accent wash with a hairline accent border.
            background: `${theme.palette.accent}22`,
            border: `1px solid ${theme.palette.accent}99`,
            borderRadius: theme.shape.small,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}
    </>
  );
}

function DesktopShortcut({
  entry,
  selected,
  onSelect,
  onOpen,
  onContextMenu,
}: {
  entry: DesktopIconEntry;
  selected: boolean;
  onSelect: (modifiers: { toggle?: boolean; range?: boolean }) => void;
  onOpen: () => void;
  onContextMenu: (x: number, y: number) => void;
}) {
  const theme = useTheme();
  const appIcon = entry.app ? resolveAppIcon(entry.app, theme) : undefined;
  const Icon = appIcon ?? entry.def?.desktopIcon ?? FolderSvg;
  const label = entry.name;
  const artFormat = entry.app?.iconFormat ?? entry.def?.iconFormat;
  // The label sits on the wallpaper, not a themed surface, so it can't rely on
  // the theme's text color: a light theme's near-black text vanishes on a dark
  // wallpaper. Over a wallpaper, use white with a dark shadow (the macOS /
  // Windows desktop treatment, readable on any image); with no wallpaper the
  // solid background is the theme's, so the theme text color is right.
  const onWallpaper = Boolean(theme.wallpaper.src);
  const labelColor = onWallpaper ? "#fff" : theme.palette.textPrimary;
  const labelShadow = onWallpaper ? "0 1px 3px rgba(0,0,0,0.8)" : "none";
  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect({ toggle: e.metaKey || e.ctrlKey, range: e.shiftKey });
  };
  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    // Keep the right-click from bubbling to the document-level
    // DesktopBackdrop handler, so the icon shows its own menu instead of
    // the generic desktop menu. Right-clicks in the column gaps still
    // fall through to the desktop menu, matching macOS.
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e.clientX, e.clientY);
  };
  return (
    <div
      role="option"
      id={optionDomId(entry.key)}
      aria-selected={selected}
      data-desktop-icon-id={entry.key}
      title={label}
      onClick={handleClick}
      onDoubleClick={onOpen}
      onContextMenu={handleContextMenu}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: ICON_LABEL_GAP,
        width: ICON_TILE + 24,
        padding: "4px 0",
        borderRadius: theme.shape.small,
        background: selected ? `${theme.palette.accent}38` : "transparent",
        cursor: "pointer",
        color: theme.palette.textPrimary,
      }}
    >
      <div
        style={{
          width: ICON_TILE,
          height: ICON_TILE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {entry.folder ? (
          <FolderTileArt folder={entry.folder} size={ICON_TILE} />
        ) : artFormat ? (
          <AppIconTile
            app={{
              name: entry.name,
              icon: entry.app?.icon ?? entry.def?.icon,
              icons: entry.app?.icons ?? entry.def?.icons,
              iconFormat: artFormat,
            }}
            size={Math.round(ICON_TILE)}
          />
        ) : (
          <Icon size={Math.round(ICON_TILE * 0.85)} />
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: labelColor,
          textShadow: labelShadow,
          whiteSpace: "nowrap",
          maxWidth: ICON_TILE + 24,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  );
}
