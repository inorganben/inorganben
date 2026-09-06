import type { App } from "@benos/core";
import { SketchIcon } from "@benos/icons";
import { SketchFluentIcon } from "@benos/icons";
import { SketchContent } from "./SketchContent";

export const sketchApp: App = {
  id: "sketch",
  name: "Sketch",
  tagline: "A quick drawing pad",
  accent: "#a855f7",
  icon: SketchIcon,
  icons: { fluent: SketchFluentIcon },
  // Where Windows files it in the Start Category view.
  category: "Creativity",
  defaultBounds: { w: 720, h: 540 },
  content: SketchContent,
};
