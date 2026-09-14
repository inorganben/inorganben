import type { App } from "@benos/core";
import { pngIcon } from "@benos/demo";
import { GhosttyContent } from "./Ghostty";

const ICON = `${import.meta.env.BASE_URL}icon/ghostty.png`;

export const ghosttyApp: App = {
  id: "ghostty",
  name: "Ghostty",
  tagline: "Terminal",
  accent: "#5f87cf",
  icon: pngIcon(ICON),
  iconFormat: "macgrid",
  defaultBounds: { w: 760, h: 580 },
  content: GhosttyContent,
};
