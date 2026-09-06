"use client";

/**
 * Module-level store for the iOS-style folder popover. Any tile (dock or
 * desktop) calls `openFolderPopover` imperatively; the single
 * `<FolderPopover>` mounted by `<Desktop>` renders it. Same
 * imperative-store shape as the context menu, snap preview, and HUD.
 */
export interface FolderPopoverRequest {
  folderId: string;
  /** Viewport rect of the tile that opened it; the panel anchors above it. */
  anchor: { left: number; top: number; width: number; height: number };
}

let current: FolderPopoverRequest | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function openFolderPopover(request: FolderPopoverRequest): void {
  current = request;
  emit();
}

export function closeFolderPopover(): void {
  if (current === null) return;
  current = null;
  emit();
}

/** Toggle helper for tiles: re-clicking the open folder closes it. */
export function toggleFolderPopover(request: FolderPopoverRequest): void {
  if (current?.folderId === request.folderId) closeFolderPopover();
  else openFolderPopover(request);
}

export function subscribeFolderPopover(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFolderPopover(): FolderPopoverRequest | null {
  return current;
}
