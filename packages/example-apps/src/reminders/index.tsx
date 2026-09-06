import type { App, AppContentProps } from "@benos/core";
import { RemindersIcon } from "@benos/icons";
import { RemindersFluentIcon } from "@benos/icons";
import { RemindersContent } from "./RemindersContent";

function Content({ appId }: AppContentProps) {
  return <RemindersContent appId={appId} />;
}

export const remindersApp: App = {
  id: "reminders",
  name: "Reminders",
  tagline: "Track what's left to do",
  accent: "#fb7185",
  icon: RemindersIcon,
  icons: { fluent: RemindersFluentIcon },
  // Where Windows files it in the Start Category view.
  category: "Productivity",
  defaultBounds: { w: 520, h: 560 },
  content: Content,
};

export { REMINDERS_STORAGE_KEY } from "./reminders-store";
