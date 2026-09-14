# Ghostty

xterm.js 前端 + 可插拔后端。当前只有 `local` 一个后端：`xterm-pty` 提供 PTY 与行规范，shell 为自写纯 TS，整体跑在浏览器里。

## 结构

- `index.tsx` — app 注册（图标、accent、bounds、content）。
- `Ghostty.tsx` — xterm 实例、FitAddon + ResizeObserver、焦点、透明度常量 `TRANSPARENCY`。
- `theme.ts` — 深/浅两套 `ITheme`；`pickTerminalTheme(desktopBg, alpha)` 按桌面背景亮度选一套并把背景转成带 alpha。
- `shell/index.ts` — 命令表 + 内存 VFS，纯模块，收 `ShellContext`，返回 `ShellResult`。
- `backends/pty-local.ts` — `openpty()`，master 挂到 xterm，slave 上跑 shell，处理 `SIGINT`。

数据流：xterm ↔ xterm-pty master/slave（行规范）↔ shell。

## 加命令

`shell/index.ts` 的 `COMMANDS` 加一项 `{ summary, usage, run(args, ctx) }`。`run` 返回 `{ output: string[], clear?, open? }`，`open` 打开对应 app。文件系统在 `FILE_SYSTEM`。不用动后端和 UI。

## 加后端

现状是 `Ghostty.tsx` 直接调用 `attachLocalPty(term, hostRef.current)`，只有一条路。要扩多后端，先抽接口：

```ts
interface TerminalBackend {
  id: string;
  label: string;
  attach(term: Terminal, host: GhosttyHost): { dispose: () => void };
}
```

`attach` 自己决定用不用 Pty：pty 类（local、emscripten）走 `openpty()`；裸流类（websocket）直接 `term.onData` / `term.write` 并同步 resize。注册表可放 `backends/registry.ts`，连接信息用 `useDesktopContext().storage` 存。

候选：

- **emscripten**：`emcc -s FORCE_FILESYSTEM -s ASYNCIFY --js-library=<xterm-pty>/emscripten-pty.js`，再 `initEmscripten({ pty: slave })`。集成绑 emscripten 版本（xterm-pty README 记 3.1.47），且无真 `fork/exec`，只能跑自包含 CUI 程序，不是真 shell。
- **websocket**：裸流接 node-pty / ttyd / GoTTY 服务端。node-pty 是原生 addon，只能在 Node 侧，跑不在浏览器里。
- **v86 / WASI**：浏览器内跑真环境，成本是镜像或 wasm 二进制【待定】。

## 改主题与透明度

- 颜色改 `theme.ts` 的 `dark` / `light`。
- 透明度改 `Ghostty.tsx` 的 `TRANSPARENCY`（0..1）。磨砂来自窗口本身（`Window.tsx` 的 `palette.surface` + `blur.surface`），终端只是半透明让其透出。
- 深浅选择现按桌面 `palette.background` 亮度判断。要精确跟随桌面明暗，需给 `DesktopContext` 加 `resolvedAppearance` 字段【待定】。

## 边界

- 单会话单窗口。
- 依赖钉在 `@xterm/xterm@5.5`：`xterm-pty@0.12` 依赖 v5 线，升 v6 需先验证其 master addon。
- `Ctrl+C` 由 ldisc 发 `SIGINT`，新提示符延后一个 tick 打印，否则 `^C` 会落在提示符之后。
- 全局快捷键在 `<textarea>` / `<input>` 上被跳过（`packages/desktop/src/keyboard-shortcuts.tsx`），终端聚焦时 `Cmd+W` 等不生效。
