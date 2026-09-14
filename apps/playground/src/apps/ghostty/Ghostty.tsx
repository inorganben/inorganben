import { useEffect, useRef } from "react";
import type { AppContentProps } from "@benos/core";
import { useWindowManager } from "@benos/core";
import { useApps, useTheme } from "@benos/desktop";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { attachLocalPty, type GhosttyHost } from "./backends/pty-local";
import { MONO, pickTerminalTheme } from "./theme";

const TRANSPARENCY = 0.6;

export function GhosttyContent({ focused }: AppContentProps) {
  const theme = useTheme();
  const apps = useApps();
  const { openWindow } = useWindowManager();

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const hostRef = useRef<GhosttyHost>({ openWindow: () => {}, apps: [] });
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

    const session = attachLocalPty(term, hostRef.current);

    const observer = new ResizeObserver(() => {
      fit.fit();
    });
    observer.observe(container);
    const frame = requestAnimationFrame(() => fit.fit());

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      session.dispose();
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
