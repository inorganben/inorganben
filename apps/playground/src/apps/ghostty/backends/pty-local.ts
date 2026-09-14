import type { Terminal } from "@xterm/xterm";
import { openpty } from "xterm-pty";
import { promptString, runCommand, type ShellApp } from "../shell";

export interface GhosttyHost {
  openWindow: (appId: string) => void;
  apps: readonly ShellApp[];
}

export interface TerminalSession {
  dispose: () => void;
}

const BANNER = "\x1b[1;34mGhostty\x1b[0m — type \x1b[1mhelp\x1b[0m\r\n";

export function attachLocalPty(term: Terminal, host: GhosttyHost): TerminalSession {
  const { master, slave } = openpty();
  term.loadAddon(master);

  const decoder = new TextDecoder();

  const dispatch = (line: string) => {
    const result = runCommand(line, {
      openWindow: host.openWindow,
      apps: host.apps,
    });
    if (result.clear) slave.write("\x1b[2J\x1b[H");
    for (const out of result.output) slave.write(`${out}\r\n`);
    if (result.open) host.openWindow(result.open);
    slave.write(promptString());
  };

  slave.write(BANNER);
  slave.write(promptString());

  const readable = slave.onReadable(() => {
    const bytes = slave.read();
    if (bytes.length === 0) return;
    let text = decoder.decode(Uint8Array.from(bytes));
    if (text.endsWith("\n")) text = text.slice(0, -1);
    for (const raw of text.split("\n")) dispatch(raw.replace(/\r$/, ""));
  });

  const signal = slave.onSignal((sig) => {
    if (sig === "SIGINT") {
      window.setTimeout(() => slave.write(`\r\n${promptString()}`), 0);
    }
  });

  return {
    dispose() {
      readable.dispose();
      signal.dispose();
    },
  };
}
