import { useMemo } from "react";
import type { App as OsApp, OsTheme } from "@benos/core";
import {
  Desktop,
  getSystemWindow,
  registerSystemWindow,
  Settings,
  useTheme,
} from "@benos/desktop";
import { buildDemoTheme, localIcon, pngIcon } from "@benos/demo";
import { exampleApps } from "@benos/example-apps";
import { BrowserContent, BrowserTitleBar } from "./Browser";
import { layout } from "./layout";
import { LaunchpadContent } from "./Launchpad";
import { ThemePicker } from "./ThemePicker";
import { useThemeChoice } from "./theme-choice";
import "./widgets";
import { UbuntuQuickSettings } from "./UbuntuQuickSettings";
import { biriApp } from "./apps/biri";

// The apps, per-theme icons, theme builder, and Settings icons all come from
// the shared @benos/demo config so the playground and the docs embed
// stay in sync. BASE_URL is "/" in dev and the Pages subpath ("/repo/") in
// CI builds, so asset URLs resolve correctly wherever the site is hosted.
const ASSET_BASE = import.meta.env.BASE_URL;

// Every app icon in this playground is art (a png/jpg), never an accent-fill
// glyph: the yaru pack covers the demo apps, generated placeholders cover the
// rest. Settings re-registers with its art icon and format.
const YARU_APPS = [
  "hello",
  "notes",
  "calculator",
  "clock",
  "calendar",
  "reminders",
  "sketch",
  "terminal",
];

function artIcon(app: OsApp): OsApp {
  if (app.id === "launchpad") return app;
  if (app.id === "browser") {
    return {
      ...app,
      icon: localIcon(`${ASSET_BASE}ben.jpg`),
      icons: undefined,
      iconFormat: "image",
    };
  }
  if (YARU_APPS.includes(app.id)) {
    return {
      ...app,
      icon: pngIcon(`${ASSET_BASE}yaru/${app.id}.png`),
      icons: undefined,
      iconFormat: "image",
    };
  }
  return app;
}

// Settings carries the theme picker above the token schema, replacing the
// old floating on-canvas switcher. Composed from the exported Settings
// rather than the captured def.content: HMR re-runs this block against a
// registry that already holds the wrapper, and composing directly keeps the
// result idempotent (a captured content would stack a picker per reload).
function SettingsWithTheme() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ThemePicker />
      <Settings />
    </div>
  );
}

{
  const def = getSystemWindow("settings");
  if (def) {
    registerSystemWindow("settings", {
      ...def,
      icon: pngIcon(`${ASSET_BASE}yaru/settings.png`),
      icons: undefined,
      iconFormat: "image",
      content: SettingsWithTheme,
    });
  }
}

function HelloContent({ focused }: { focused: boolean }) {
  const theme = useTheme();
  return (
    <div>
      <h2 style={{ margin: "0 0 8px" }}>Hello, desktop.</h2>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Seven working apps share the dock with this one: Notes, Calculator, Clock,
        Calendar, Reminders, Sketch, and Terminal. Each is a real app, not a screenshot.
        Open one from the dock, from Spotlight, or with its number key.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Drag the title bar. Drag any edge or corner to resize. Double-click the title
        bar (or click the green light) to maximize, then press Escape to restore.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Press <kbd>Cmd-K</kbd> or <kbd>Ctrl-K</kbd> for Spotlight, <kbd>Cmd-,</kbd> for
        Settings. <kbd>Cmd-W</kbd> closes, <kbd>Cmd-M</kbd> minimizes, and{" "}
        <kbd>Cmd-1</kbd> through <kbd>Cmd-9</kbd> jump straight to an app.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Notes, reminders, and calendar events persist across reloads. In Terminal, type{" "}
        <kbd>open calendar</kbd> to launch an app straight from the shell.
      </p>
      <p style={{ margin: "0 0 8px", opacity: 0.78 }}>
        Use the theme switcher at the top to swap the whole look between macOS, Windows,
        and Ubuntu. Each clones its platform's chrome: Windows trades the traffic lights
        for caption buttons and a flush taskbar that does not magnify; Ubuntu pairs a
        top bar with a left dock, centers the clock, and opens Quick Settings from the
        status cluster.
      </p>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
        Window focused: <strong>{focused ? "yes" : "no"}</strong>
      </p>
    </div>
  );
}

const helloApp: OsApp = {
  id: "hello",
  name: "Hello",
  tagline: "Start here",
  accent: "#6b8afd",
  content: HelloContent,
  defaultBounds: { w: 580, h: 460 },
};

// Placeholder window body for every personal app. The real content is
// authored per app later; until then each opens to this one line.
function ComingSoonContent() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
        opacity: 0.78,
      }}
    >
      内容施工中🚧
    </div>
  );
}

const browserApp: OsApp = {
  id: "browser",
  name: "Browser",
  tagline: "View any site that allows framing",
  accent: "#3aa0e8",
  chrome: { titleBar: BrowserTitleBar, radius: 14, overflow: "visible" },
  defaultBounds: { w: 900, h: 640 },
  content: BrowserContent,
};

const launchpadApp: OsApp = {
  id: "launchpad",
  name: "Launchpad",
  tagline: "All apps",
  accent: "#35b6ff",
  icon: pngIcon(`${ASSET_BASE}launchpad.png`),
  iconFormat: "macgrid",
  defaultBounds: { w: 720, h: 560 },
  content: LaunchpadContent,
};

// Personal homepage apps. Every entry is a registered placeholder (opens to
// "内容施工中"); real content is authored one app at a time. default.png is
// derived from icon/default.icns (macOS grid: transparent padding + rounded
// art baked in, hence "macgrid").
// Authored icons live at icon/<id>.png (converted from the user's icns/webp
// drop in public/icns). "macgrid" = .icns sources with baked padding and
// corners; "image" = logo exports where the library adds the corners.
// Everything else sits on the default.icns placeholder.
const ART_ICONS: Record<string, "macgrid" | "image"> = {
  android: "macgrid",
  arduino: "macgrid",
  biri: "macgrid",
  calc: "macgrid",
  docker: "macgrid",
  ghostty: "macgrid",
  hackintosh: "macgrid",
  math: "macgrid",
  mc: "macgrid",
  milktea: "macgrid",
  python: "macgrid",
  writing: "macgrid",
  aifeng: "macgrid",
  kubernetes: "image",
  linux: "image",
  mac: "image",
  bookshelf: "image",
};

function placeholderApp(id: string, name: string, extra?: Partial<OsApp>): OsApp {
  const art = ART_ICONS[id];
  return {
    id,
    name,
    accent: "#8a8a93",
    icon: pngIcon(`${ASSET_BASE}icon/${art ? id : "default"}.png`),
    iconFormat: art ?? "macgrid",
    defaultBounds: { w: 720, h: 560 },
    content: ComingSoonContent,
    ...extra,
  };
}

type Named = [id: string, name: string];

const CLIENT: Named[] = [
  ["android", "安卓"],
  ["harmony", "鸿蒙"],
  ["mac", "Mac"],
];
const LANG: Named[] = [
  ["java", "Java"],
  ["cpp", "C/C++"],
  ["kotlin", "Kotlin"],
  ["golang", "Golang"],
  ["rust", "Rust"],
  ["haskell", "Haskell"],
  ["dart", "Dart"],
  ["verilog", "Verilog"],
];
const STACK: Named[] = [
  ["deno", "Deno"],
  ["bun", "Bun"],
];
const HARDWARE: Named[] = [
  ["arduino", "Arduino"],
  ["esp32", "ESP32"],
  ["stm32", "STM32"],
  ["raspberrypi", "树莓派"],
  ["micropython", "MicroPython"],
  ["fpga", "FPGA"],
  ["xiaoxiongpi", "小熊派"],
];

const topSolo: Named[] = [
  ["math", "数学"],
  ["kubernetes", "Kubernetes"],
  ["calligraphy", "书法"],
  ["linux", "Linux"],
  ["ghostty", "Ghostty"],
  ["docker", "Docker"],
  ["bookshelf", "书架"],
];
const bottomSolo: Named[] = [
  ["mc", "Minecraft"],
  ["terraria", "泰拉瑞亚"],
  ["philosophy", "哲学"],
  ["history", "历史"],
  ["writing", "写作"],
  ["travel", "游记"],
  ["hackintosh", "黑苹果"],
  ["python", "Python"],
  ["physics", "物理"],
  ["anime", "动漫"],
  ["print3d", "3D打印"],
  ["milktea", "奶茶"],
  ["calc", "计算器"],
  ["aifeng", "艾锋"],
];

const aboutMeApp = placeholderApp("about-me", "苯达", {
  icon: localIcon(`${ASSET_BASE}ben.jpg`),
  iconFormat: "image",
  accent: "#6b8afd",
});

const personalApps: OsApp[] = [
  aboutMeApp,
  ...topSolo.map(([id, name]) => placeholderApp(id, name)),
  ...CLIENT.map(([id, name]) => placeholderApp(id, name)),
  ...LANG.map(([id, name]) => placeholderApp(id, name)),
  ...STACK.map(([id, name]) => placeholderApp(id, name)),
  ...HARDWARE.map(([id, name]) => placeholderApp(id, name)),
  ...bottomSolo.map(([id, name]) => placeholderApp(id, name)),
  biriApp,
];

// Utility apps stay registered (reachable from Launchpad tail, Spotlight,
// Cmd-, for Settings) but are not placed in the dock or desktop.
const baseApps: OsApp[] = [...personalApps, helloApp, browserApp, ...exampleApps].map(
  artIcon,
);

export default function App() {
  const themeChoice = useThemeChoice();
  const theme = useMemo<OsTheme>(
    () => buildDemoTheme(themeChoice, ASSET_BASE),
    [themeChoice],
  );
  // The Launchpad tile is a BenOS exclusive; the other themes keep the
  // stock registry.
  const apps = useMemo<OsApp[]>(
    () => (themeChoice === "benos" ? [launchpadApp, ...baseApps] : baseApps),
    [themeChoice],
  );

  return (
    <Desktop apps={apps} theme={theme} layout={layout}>
      {themeChoice === "ubuntu" && <UbuntuQuickSettings />}
    </Desktop>
  );
}
