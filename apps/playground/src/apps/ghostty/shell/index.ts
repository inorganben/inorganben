import { DISTROS, findDistro } from "../../linux/data/distros";
import { isCached } from "../../linux/store";

export interface ShellApp {
  id: string;
  name: string;
}

export interface ShellContext {
  openWindow: (appId: string) => void;
  apps: readonly ShellApp[];
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
