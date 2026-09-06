"use client";

import type { ReactNode } from "react";
import type { App, LayoutConfig, OsTheme, StorageAdapter } from "@benos/core";
import { WindowManagerProvider } from "@benos/core";
import { DesktopContextProvider } from "./desktop-context";
import { StyleInjector } from "./style-injector";

export interface DesktopProviderProps {
  apps: App[];
  theme: OsTheme;
  /** Optional storage backend override. Defaults to localStorage. */
  storage?: StorageAdapter;
  /** Optional layout projection (dock / desktop / all-apps / folders). */
  layout?: LayoutConfig;
  children: ReactNode;
}

/**
 * Lift-the-hood mode. Wrap your own composition of `<Wallpaper>`,
 * `<MenuBar>`, `<Dock>`, `<WindowLayer>`, and `<Spotlight>`. Use
 * `<Desktop>` instead for the one-line entry point.
 */
export function DesktopProvider({
  apps,
  theme,
  storage,
  layout,
  children,
}: DesktopProviderProps) {
  return (
    <DesktopContextProvider apps={apps} theme={theme} storage={storage} layout={layout}>
      <WindowManagerProvider>
        <StyleInjector />
        {children}
      </WindowManagerProvider>
    </DesktopContextProvider>
  );
}
