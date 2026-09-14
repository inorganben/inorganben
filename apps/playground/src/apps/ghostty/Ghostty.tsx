import { useEffect, useRef } from "react";
import type { AppContentProps } from "@benos/core";
import { useWindowManager } from "@benos/core";
import { useApps, useTheme } from "@benos/desktop";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { findDistro } from "../linux/data/distros";
import { refreshCache } from "../linux/store";
import { attachLocalPty, type GhosttyHost } from "./backends/pty-local";
import { attachV86Serial } from "./backends/v86-serial";
import { MONO, pickTerminalTheme } from "./theme";

const TRANSPARENCY = 0.6;

interface Session {
  dispose: () => void;
}

export function GhosttyContent({ focused }: AppContentProps) {
  const theme = useTheme();
  const apps = useApps();
  const { openWindow } = useWindowManager();

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const hostRef = useRef<GhosttyHost>({
    openWindow: () => {},
    apps: [],
    onBoot: () => {},
  });
  const backgroundRef = useRef(theme.palette.background);

  useEffect(() => {
    hostRef.current.openWindow = (appId) => openWindow({ kind: "app", appId });
    hostRef.current.apps = apps;
    backgroundRef.current = theme.palette.background;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: MONO,
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      allowTransparency: true,
      theme: pickTerminalTheme(backgroundRef.current, TRANSPARENCY),
    });
    termRef.current = term;

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    const observer = new ResizeObserver(() => {
      fit.fit();
    });
    observer.observe(container);
    const frame = requestAnimationFrame(() => fit.fit());

    void refreshCache();

    // The terminal hosts one session at a time: either the JS shell or a
    // booted Linux serial console. Boot disposes the shell and takes over;
    // exiting the guest (or Ctrl+]) tears the emulator down and starts a fresh
    // shell on the same xterm.
    let shell: Session | null = null;
    let guest: Session | null = null;
    let torn = false;

    const startShell = () => {
      if (torn) return;
      shell = attachLocalPty(term, hostRef.current);
    };

    const handleGuestExit = () => {
      guest = null;
      if (torn) return;
      term.reset();
      startShell();
    };

    const boot = async (id: string) => {
      const distro = findDistro(id);
      if (!distro?.boot) return;
      shell?.dispose();
      shell = null;
      term.reset();
      term.writeln(`\x1b[2mBooting ${distro.name}…  (Ctrl+] 断开)\x1b[0m`);
      try {
        const session = await attachV86Serial(term, distro, {
          onExit: handleGuestExit,
        });
        if (torn) {
          session.dispose();
          return;
        }
        guest = session;
      } catch (error) {
        if (torn) return;
        const message = error instanceof Error ? error.message : String(error);
        term.writeln(`\x1b[31mboot failed: ${message}\x1b[0m`);
        startShell();
      }
    };

    hostRef.current.onBoot = (id) => {
      void boot(id);
    };

    startShell();

    return () => {
      torn = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      shell?.dispose();
      guest?.dispose();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (focused) termRef.current?.focus();
  }, [focused]);

  return (
    <div
      ref={containerRef}
      style={{
        margin: -16,
        width: "calc(100% + 32px)",
        height: "calc(100% + 32px)",
        overflow: "hidden",
      }}
    />
  );
}
