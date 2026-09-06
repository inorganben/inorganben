"use client";

import type { App } from "@benos/core";
import { useTheme } from "./desktop-context";
import { resolveAppIcon } from "./util/app-icon";

type ArtApp = Pick<App, "name" | "icon" | "icons" | "iconFormat">;

/**
 * The single art-icon renderer shared by the dock, the desktop shortcuts,
 * and the launcher grid, so one `iconFormat` declaration looks identical
 * everywhere. "image" gets Apple's 22.4% corner radius (the ratio the
 * Big Sur icon grid uses) applied by the library; "macgrid" assets carry
 * their own padding and corners and paint bare. A declared format with no
 * resolvable icon falls back to a neutral letter tile, never an accent
 * fill.
 */
export function AppIconTile({
  app,
  size,
  shadow = true,
}: {
  app: ArtApp;
  size: number;
  shadow?: boolean;
}) {
  const theme = useTheme();
  const Icon = resolveAppIcon(app, theme);
  if (!Icon) {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.224),
          background: theme.palette.textSecondary,
          color: theme.palette.background,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(size * 0.45),
          fontWeight: 600,
          fontFamily: "inherit",
          boxShadow: shadow ? "0 3px 8px rgba(0,0,0,0.3)" : undefined,
        }}
      >
        {app.name.charAt(0).toUpperCase()}
      </span>
    );
  }
  // drop-shadow (not box-shadow) so the shadow follows the artwork's alpha
  // outline: the rounded square of an "image" icon, the exact shape of a
  // transparent-padded "macgrid" asset, the letter tile alike.
  const art = (
    <span
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: app.iconFormat === "macgrid" ? 0 : Math.round(size * 0.224),
        overflow: app.iconFormat === "macgrid" ? "visible" : "hidden",
        filter: shadow ? "drop-shadow(0 3px 8px rgba(0,0,0,0.3))" : undefined,
        flexShrink: 0,
      }}
    >
      {/* macOS icon grid: the art fills most of the canvas. Scale the canvas
          up so the visible art, not the padding, matches the tile. 0.85 reads
          true beside full-bleed "image" icons (real icns padding runs slightly
          under the nominal 20%). */}
      <Icon size={app.iconFormat === "macgrid" ? Math.round(size / 0.85) : size} />
    </span>
  );
  return art;
}
