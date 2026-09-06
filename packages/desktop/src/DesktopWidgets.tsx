"use client";

import { useSyncExternalStore } from "react";
import { useWindowManager } from "@benos/core";
import { useDesktopContext, useTheme } from "./desktop-context";
import {
  getDesktopWidget,
  getDesktopWidgetsVersion,
  subscribeDesktopWidgets,
} from "./desktop-widgets";
import { getChromeMetrics, getDockReservation } from "./util/layout";
import { useViewportMode } from "./util/viewport-mode";

const EDGE_INSET = 14;
const GAP = 14;
const EMPTY: string[] = [];

/**
 * The desktop widget layer: a top-right column of cards, above the wallpaper
 * and below the windows, filtered to the active workspace by
 * `layout.workspaces[].widgets`. Switching workspaces swaps the column with
 * it, the macOS Widgets / GNOME dashboard placement.
 */
export function DesktopWidgets() {
  const theme = useTheme();
  const { layout } = useDesktopContext();
  const { state } = useWindowManager();
  // Subscribe to registry changes so late registerDesktopWidget calls repaint.
  useSyncExternalStore(
    subscribeDesktopWidgets,
    getDesktopWidgetsVersion,
    getDesktopWidgetsVersion,
  );

  const mode = useViewportMode();
  const metrics = getChromeMetrics(mode);
  const dock = getDockReservation(theme);
  const ids =
    layout?.workspaces?.find((w) => w.id === state.activeWorkspaceId)?.widgets ?? EMPTY;
  if (ids.length === 0) return null;
  const top =
    (theme.chrome.menuBar === "top" ? metrics.menuBarHeight : 0) +
    dock.top +
    EDGE_INSET;
  const right = dock.right + EDGE_INSET;

  return (
    <div
      style={{
        position: "fixed",
        top,
        right,
        display: "flex",
        flexDirection: "column",
        gap: GAP,
        zIndex: 1,
        pointerEvents: "none",
      }}
    >
      {ids.map((id) => {
        const def = getDesktopWidget(id);
        if (!def) return null;
        const Widget = def.component;
        return (
          <section
            key={id}
            aria-label={def.name}
            style={{
              width: def.width,
              pointerEvents: "auto",
              borderRadius: theme.shape.windowRadius,
              background: theme.palette.surface,
              backdropFilter: theme.blur.surface,
              WebkitBackdropFilter: theme.blur.surface,
              border: `1px solid ${theme.palette.border}`,
              boxShadow: theme.elevation?.windowUnfocused,
              color: theme.palette.textPrimary,
              padding: 16,
              boxSizing: "border-box",
            }}
          >
            <Widget />
          </section>
        );
      })}
    </div>
  );
}
