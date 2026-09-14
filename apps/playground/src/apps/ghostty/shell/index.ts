import { DISTROS, findDistro } from "../../linux/data/distros";
import { isCached } from "../../linux/store";
import { BEN_BANNER } from "./ben";

export interface ShellApp {
  id: string;
  name: string;
}

export interface ShellContext {
  openWindow: (appId: string) => void;
  apps: readonly ShellApp[];
  /** Terminal viewport size in px, for bastfetch's Display line. */
  size: () => { width: number; height: number };
}

function linuxList(): string[] {
  const width = Math.max(...DISTROS.map((d) => d.id.length));
  return [
    "Linux images:",
    ...DISTROS.map((d) => {
      const status = !d.boot ? "待支持" : isCached(d.id) ? "已下载" : "未下载";
      return `  ${d.id.padEnd(width)}  ${d.size.padEnd(7)}  ${status}  ${d.name}`;
    }),
    "用法: linux boot <id>",
  ];
}

/* ── bastfetch ──────────────────────────────────────────────── */

const TEAL = "\x1b[38;2;0;248;198m";
const RESET = "\x1b[0m";

const BASTFETCH_FIELDS: readonly [string, string][] = [
  ["OS", "BenOS 1.0.92"],
  ["Host", "BenOS Besktop"],
  ["Kernel", "42.6.16-benos"],
  ["Uptime", "5 Myr"],
  ["Packages", "TREE(3)"],
  ["Shell", "ben-sh"],
  ["Display", ""],
  ["WM", "BenOS DE"],
  ["WM Theme", "Teal"],
  ["Theme", "Solid Glass"],
  ["Font", "SF Mono (13pt)"],
  ["Terminal", "Ghostty"],
  ["CPU", "BastCore i686 @ 32THz"],
  ["GPU", "Imagination"],
  ["Memory", "114514B"],
  ["Swap", "\u03c0 B"],
  ["Disk (/)", "universe"],
  ["Local IP", "192.168.22.11"],
  ["Battery", "infinity [BC]"],
  ["Locale", "CN_zh.BTF-7"],
];

// fastfetch shows normal colours on the top row and their bright variants below.
const COLOR_BAND_ROWS = [
  [40, 41, 42, 43, 44, 45, 46, 47],
  [100, 101, 102, 103, 104, 105, 106, 107],
].map((row) => row.map((code) => `\x1b[${String(code)}m   `).join("") + RESET);

function visibleWidth(text: string): number {
  let width = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === "\x1b" && text[i + 1] === "[") {
      i += 2;
      while (i < text.length && text[i] !== "m") i++;
      i++;
      continue;
    }
    width++;
    i++;
  }
  return width;
}

/** fastfetch, but the mark sits on the left and the facts are all lies. */
function bastfetch(ctx: ShellContext): string[] {
  const { width, height } = ctx.size();
  const display = `${String(width)}x${String(height)} @47Hz [Built-out]`;
  const infoWidth = 46;
  const logoWidth = visibleWidth(BEN_BANNER[0] ?? "");
  const info: string[] = [
    `${TEAL}\x1b[1mxenonben@benos${RESET}${TEAL}${"\u2500".repeat(Math.max(0, infoWidth - 14))}${RESET}`,
    ...BASTFETCH_FIELDS.map(([key, value]) => {
      const shown = key === "Display" ? display : value;
      return `${TEAL}${key.padEnd(10)}${RESET}${shown}`;
    }),
    ...COLOR_BAND_ROWS,
  ];
  const rows = Math.max(info.length, BEN_BANNER.length);
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    const left = BEN_BANNER[i] ?? "";
    const pad = " ".repeat(Math.max(0, logoWidth - visibleWidth(left)));
    out.push(`  ${left}${pad}    ${info[i] ?? ""}`);
  }
  return out;
}

export interface ShellResult {
  output: string[];
  clear?: boolean;
  open?: string;
  /** Distro id to hand the terminal over to. */
  boot?: string;
}

const USER = "xenonben";
const CWD = "~";

export function promptString(): string {
  return `\x1b[1;32m${USER}@benos\x1b[0m:\x1b[1;34m${CWD}\x1b[0m$ `;
}

type FsNode =
  | { type: "dir"; children: Record<string, FsNode> }
  | { type: "file"; content: string };

function createFileSystem(): FsNode {
  return {
    type: "dir",
    children: {
      Desktop: { type: "dir", children: {} },
      Documents: {
        type: "dir",
        children: {
          "readme.txt": {
            type: "file",
            content:
              "Ghostty on BenOS.\nTry: help, ls, cat Documents/notes.md, open calculator.",
          },
          "notes.md": {
            type: "file",
            content: "# Notes\n- pty layer by xterm-pty\n- shell by hand, pure TS",
          },
        },
      },
      Downloads: { type: "dir", children: {} },
    },
  };
}

const FILE_SYSTEM = createFileSystem();

function resolvePath(root: FsNode, path: string): FsNode | null {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "." || trimmed === "/" || trimmed === "~")
    return root;
  const segments = trimmed
    .replace(/^[~/]+/, "")
    .split("/")
    .filter((s) => s.length > 0 && s !== ".");
  let node: FsNode = root;
  for (const segment of segments) {
    if (node.type !== "dir") return null;
    const next = node.children[segment];
    if (!next) return null;
    node = next;
  }
  return node;
}

function listDir(node: Extract<FsNode, { type: "dir" }>): string[] {
  return Object.entries(node.children)
    .filter(([name]) => !name.startsWith("."))
    .map(([name, child]) => (child.type === "dir" ? `${name}/` : name))
    .sort((a, b) => a.localeCompare(b));
}

interface CommandDef {
  summary: string;
  usage: string;
  run: (args: string[], ctx: ShellContext) => ShellResult;
}

const COMMANDS: Record<string, CommandDef> = {
  help: {
    summary: "List available commands.",
    usage: "help",
    run: () => {
      const defs = Object.values(COMMANDS).sort((a, b) =>
        a.usage.localeCompare(b.usage),
      );
      const width = Math.max(...defs.map((d) => d.usage.length));
      return {
        output: [
          "Available commands:",
          ...defs.map((d) => `  ${d.usage.padEnd(width)}  ${d.summary}`),
        ],
      };
    },
  },
  echo: {
    summary: "Print the given text.",
    usage: "echo <text>",
    run: (args) => ({ output: [args.join(" ")] }),
  },
  pwd: {
    summary: "Print the working directory.",
    usage: "pwd",
    run: () => ({ output: [CWD] }),
  },
  whoami: {
    summary: "Print the current user.",
    usage: "whoami",
    run: () => ({ output: [USER] }),
  },
  date: {
    summary: "Print the current date and time.",
    usage: "date",
    run: () => ({ output: [new Date().toString()] }),
  },
  ls: {
    summary: "List directory contents.",
    usage: "ls [path]",
    run: (args) => {
      const path = args[0] ?? "";
      const node = resolvePath(FILE_SYSTEM, path);
      if (!node) {
        return { output: [`ls: ${path || "."}: No such file or directory`] };
      }
      if (node.type === "file") return { output: [path] };
      const entries = listDir(node);
      return { output: entries.length > 0 ? [entries.join("  ")] : [] };
    },
  },
  cat: {
    summary: "Print a file's contents.",
    usage: "cat <file>",
    run: (args) => {
      const path = args[0];
      if (!path) return { output: ["cat: missing file operand"] };
      const node = resolvePath(FILE_SYSTEM, path);
      if (!node) return { output: [`cat: ${path}: No such file or directory`] };
      if (node.type === "dir") return { output: [`cat: ${path}: Is a directory`] };
      return { output: node.content.split("\n") };
    },
  },
  clear: {
    summary: "Clear the screen.",
    usage: "clear",
    run: () => ({ output: [], clear: true }),
  },
  about: {
    summary: "About Ghostty on BenOS.",
    usage: "about",
    run: () => ({
      output: ["Ghostty: an xterm.js terminal with a pluggable backend."],
    }),
  },
  ben: {
    summary: "Print the BenOS mark.",
    usage: "ben",
    run: () => ({ output: [...BEN_BANNER] }),
  },
  bastfetch: {
    summary: "Show the BenOS system fetch.",
    usage: "bastfetch",
    run: (_args, ctx) => ({ output: bastfetch(ctx) }),
  },
  open: {
    summary: "Open a desktop app by id.",
    usage: "open <appId>",
    run: (args, ctx) => {
      const appId = args[0];
      const listing = (): string[] => {
        if (ctx.apps.length === 0) return ["open: no apps available"];
        const width = Math.max(...ctx.apps.map((a) => a.id.length));
        return [
          "Open one of:",
          ...ctx.apps
            .slice()
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((a) => `  ${a.id.padEnd(width)}  ${a.name}`.trimEnd()),
        ];
      };
      if (!appId) return { output: listing() };
      const target = ctx.apps.find((a) => a.id === appId);
      if (!target) {
        return { output: [`open: ${appId}: no such app`, ...listing()] };
      }
      return { output: [`Opening ${target.name}…`], open: appId };
    },
  },
  linux: {
    summary: "List or boot cached Linux images.",
    usage: "linux <ls|boot> [id]",
    run: (args) => {
      const sub = args[0];
      if (!sub || sub === "ls") return { output: linuxList() };
      if (sub !== "boot") {
        return { output: [`linux: unknown subcommand: ${sub}`, ...linuxList()] };
      }
      const id = args[1];
      if (!id) return { output: ["linux boot: missing <id>", ...linuxList()] };
      const distro = findDistro(id);
      if (!distro) {
        return { output: [`linux boot: ${id}: no such distro`, ...linuxList()] };
      }
      if (!distro.boot) {
        return { output: [`${distro.name}: ${distro.pending ?? "暂不支持终端启动"}`] };
      }
      if (!isCached(id)) {
        return { output: [`${distro.name} 未下载，先在 Linux 应用里下载它。`] };
      }
      return {
        output: [],
        boot: id,
      };
    },
  },
};

export function commandNames(): string[] {
  return Object.keys(COMMANDS).sort((a, b) => a.localeCompare(b));
}

export function runCommand(line: string, ctx: ShellContext): ShellResult {
  const trimmed = line.trim();
  if (trimmed === "") return { output: [] };
  const words = trimmed.split(/\s+/);
  const name = words[0] ?? "";
  const command = COMMANDS[name];
  if (!command) return { output: [`${name}: command not found`] };
  return command.run(words.slice(1), ctx);
}
