"use client";

import type { ReactNode } from "react";
import type { App, LayoutConfig, OsTheme, StorageAdapter } from "@benos/core";
import { DesktopProvider } from "./DesktopProvider";
import { Wallpaper } from "./Wallpaper";
import { MenuBar } from "./MenuBar";
import { Dock } from "./Dock";
import { WindowLayer } from "./WindowLayer";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { Launcher } from "./launcher";
import { DesktopIcons } from "./DesktopIcons";
import { DesktopWidgets } from "./DesktopWidgets";
import { FolderPopover } from "./FolderPopover";
import { NotificationToasts } from "./NotificationToasts";
import { NotificationCenter } from "./NotificationCenter";
import { QuickSettings } from "./QuickSettings";
import { ContextMenu } from "./context-menu";
import { DesktopBackdrop } from "./desktop-backdrop";
import { SnapPreview } from "./snap";
import { AppSwitcher } from "./AppSwitcher";
import { MissionControl } from "./MissionControl";
import { KeyboardHelp } from "./KeyboardHelp";
import { HudOverlay } from "./hud";

export interface DesktopProps {
  apps: App[];
  theme: OsTheme;
  /** Optional brand label shown in the menu bar. */
  brand?: string;
  /** Optional storage backend override. Defaults to localStorage. */
  storage?: StorageAdapter;
  /** Optional layout projection (dock / desktop / all-apps / folders). */
  layout?: LayoutConfig;
  /**
   * Extra children rendered inside the provider, alongside the default
   * surfaces. Useful for headless companions like analytics, URL sync,
   * or deep-link activators that need access to `useWindowManager()`.
   */
  children?: ReactNode;
}

/**
 * One-line desktop. Wraps the provider stack and composes the default
 * surfaces: wallpaper, menu bar, dock, window layer, keyboard shortcuts,
 * and Spotlight. Replace with `<DesktopProvider>` + your own layout when
 * you need finer control.
 */
export function Desktop({
  apps,
  theme,
  brand,
  storage,
  layout,
  children,
}: DesktopProps) {
  return (
    <DesktopProvider apps={apps} theme={theme} storage={storage} layout={layout}>
      <div
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          fontFamily: theme.font ?? "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <Wallpaper />
        <MenuBar brand={brand} />
        <DesktopIcons />
        <DesktopWidgets />
        <SnapPreview />
        <WindowLayer />
        <Dock />
        <KeyboardShortcuts />
        <Launcher />
        <NotificationToasts />
        <NotificationCenter />
        <QuickSettings />
        <ContextMenu />
        <FolderPopover />
        <AppSwitcher />
        <MissionControl />
        <KeyboardHelp />
        <HudOverlay />
        <DesktopBackdrop />
      </div>
      {children}
    </DesktopProvider>
  );
}
