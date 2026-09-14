import type { ITheme } from "@xterm/xterm";

export const MONO =
  '"SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const dark: ITheme = {
  background: "#282c34",
  foreground: "#dcdfe4",
  cursor: "#528bff",
  cursorAccent: "#282c34",
  selectionBackground: "rgba(97, 175, 239, 0.35)",
  black: "#282c34",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#dcdfe4",
  brightBlack: "#5c6370",
  brightRed: "#e06c75",
  brightGreen: "#98c379",
  brightYellow: "#e5c07b",
  brightBlue: "#61afef",
  brightMagenta: "#c678dd",
  brightCyan: "#56b6c2",
  brightWhite: "#ffffff",
};

const light: ITheme = {
  background: "#fafafa",
  foreground: "#383a42",
  cursor: "#526fff",
  cursorAccent: "#fafafa",
  selectionBackground: "rgba(64, 120, 242, 0.25)",
  black: "#383a42",
  red: "#e45649",
  green: "#50a14f",
  yellow: "#c18401",
  blue: "#4078f2",
  magenta: "#a626a4",
  cyan: "#0184bc",
  white: "#a0a1a7",
  brightBlack: "#696c77",
  brightRed: "#e45649",
  brightGreen: "#50a14f",
  brightYellow: "#c18401",
  brightBlue: "#4078f2",
  brightMagenta: "#a626a4",
  brightCyan: "#0184bc",
  brightWhite: "#ffffff",
};

export const terminalThemes: { dark: ITheme; light: ITheme } = { dark, light };

/** "#rrggbb" -> perceived luminance (0..1). Accepts the theme's hex background. */
function luminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0;
  const value = parseInt(match[1] ?? "000000", 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function pickTerminalTheme(background: string, alpha = 1): ITheme {
  const base = luminance(background) > 0.5 ? light : dark;
  if (alpha >= 1) return base;
  return { ...base, background: hexToRgba(base.background ?? "#000000", alpha) };
}

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1] ?? "000000", 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}
