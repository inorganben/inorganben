import type { App, AppContentProps } from "@benos/core";
import { CalendarIcon } from "@benos/icons";
import { CalendarFluentIcon } from "@benos/icons";
import { CalendarContent } from "./CalendarContent";

function Content({ appId }: AppContentProps) {
  return <CalendarContent appId={appId} />;
}

export const calendarApp: App = {
  id: "calendar",
  name: "Calendar",
  tagline: "Month at a glance",
  accent: "#ef4444",
  icon: CalendarIcon,
  icons: { fluent: CalendarFluentIcon },
  // Where Windows files it in the Start Category view.
  category: "Productivity",
  defaultBounds: { w: 720, h: 600 },
  content: Content,
};

export { CALENDAR_STORAGE_KEY } from "./calendar-store";
