import type { App } from "@benos/core";
import { pngIcon } from "@benos/demo";
import { LinuxContent } from "./Linux";

const ICON = `${import.meta.env.BASE_URL}icon/linux.png`;

export const linuxApp: App = {
  id: "linux",
  name: "Linux",
  tagline: "下载并启动 Linux 镜像",
  accent: "#5a7fa8",
  icon: pngIcon(ICON),
  iconFormat: "image",
  defaultBounds: { w: 780, h: 600 },
  content: LinuxContent,
};
