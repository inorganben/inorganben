# @benos/core

Pure logic and types for BenOS. The window manager, the storage
contract, the settings overlay, and the notification store live here; the
components that render them live in `@benos/desktop`. This package never
imports the desktop, and themes depend on it for types only.

## Entry points

| Import                       | Contents                                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| `@benos/core`                | everything below, plus `App`, `OsTheme`, and the customizable field types |
| `@benos/core/window-manager` | `WindowManagerProvider`, `useWindowManager`, reducer, `windowIdOf`        |
| `@benos/core/storage`        | `StorageAdapter`, `createLocalStorageAdapter`                             |
| `@benos/core/settings`       | `applyPrefs`, `applyAppearance`, `getPath`, `setPath`                     |
| `@benos/core/notifications`  | `notify`, `useNotifications`, the notification store                      |

The root, `window-manager`, and `notifications` bundles carry a `"use client"`
directive (they contain hooks and context). `storage` and `settings` are plain
logic and import cleanly from server code.

## Usage

```ts
import { notify } from "@benos/core";

notify({ appId: "mail", title: "Inbox", body: "3 new messages" });
```

`<Desktop>` mounts the renderer; any code anywhere calls the imperative
function. The same shape (module store, imperative call, renderer in the
desktop package) carries the context menu, HUD, snap preview, and status tray.

## Install

```bash
pnpm add @benos/core @benos/desktop @benos/theme-macos
```

`@benos/desktop` declares this package as a peer dependency so exactly
one copy is installed: the window manager context and the module-level stores
are singletons, and a duplicated copy would split them.
