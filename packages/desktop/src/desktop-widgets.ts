"use client";

import type { ComponentType } from "react";

/**
 * Desktop widgets are small always-on surfaces on the wallpaper layer: a
 * clock, a system readout, a photo frame. Same module-store shape as the
 * status tray and the spotlight sources: register imperatively from any
 * code, the single `<DesktopWidgets>` mounted by `<Desktop>` renders them,
 * and `layout.workspaces[].widgets` decides which workspace shows which.
 */
export interface DesktopWidgetDef {
  /** Visible name, used as the card's aria-label. */
  name: string;
  /** Card width in px; height is left to the content. */
  width: number;
  component: ComponentType;
}

const widgets = new Map<string, DesktopWidgetDef>();
const listeners = new Set<() => void>();
// Numeric change counter: the stable getSnapshot for useSyncExternalStore.
let version = 0;

function emit(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function getDesktopWidgetsVersion(): number {
  return version;
}

/** Register a widget definition. Re-registering the same id replaces it. */
export function registerDesktopWidget(id: string, def: DesktopWidgetDef): void {
  widgets.set(id, def);
  emit();
}

export function unregisterDesktopWidget(id: string): void {
  if (!widgets.has(id)) return;
  widgets.delete(id);
  emit();
}

export function getDesktopWidget(id: string): DesktopWidgetDef | undefined {
  return widgets.get(id);
}

export function subscribeDesktopWidgets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
