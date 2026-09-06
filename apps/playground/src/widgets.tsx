import { useEffect, useState } from "react";
import { useWindowManager } from "@benos/core";
import { registerDesktopWidget, useDesktopContext, useTheme } from "@benos/desktop";

function ClockWidget() {
  const theme = useTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div>
      <div
        style={{ fontSize: 30, fontWeight: 300, fontVariantNumeric: "tabular-nums" }}
      >
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div style={{ fontSize: 12, color: theme.palette.textSecondary, marginTop: 4 }}>
        {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
      </div>
    </div>
  );
}

function SystemWidget() {
  const theme = useTheme();
  const { state } = useWindowManager();
  const { layout } = useDesktopContext();
  const open = state.windows.filter(
    (w) => w.workspaceId === state.activeWorkspaceId,
  ).length;
  const wsName =
    layout?.workspaces?.find((w) => w.id === state.activeWorkspaceId)?.name ??
    `Workspace ${state.activeWorkspaceId}`;
  return (
    <div style={{ fontSize: 12, display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{wsName}</div>
      <div style={{ color: theme.palette.textSecondary }}>
        {open} window{open === 1 ? "" : "s"} open
      </div>
      <div style={{ color: theme.palette.textSecondary }}>
        {state.workspaces.length} workspaces
      </div>
    </div>
  );
}

registerDesktopWidget("playground-clock", {
  name: "Clock",
  width: 180,
  component: ClockWidget,
});

registerDesktopWidget("playground-system", {
  name: "System",
  width: 180,
  component: SystemWidget,
});
