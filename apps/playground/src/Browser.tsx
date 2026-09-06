import { useState } from "react";
import type { AppTitleBarProps } from "@benos/core";

// A 7x8 pixel-art sprout (Animal Crossing rose) sitting on the bar's top
// edge and painting outside the window frame, exercising
// `chrome.overflow: "visible"`.
function PixelFlower() {
  const cells: [number, number, string][] = [
    [2, 0, "#e5484d"],
    [3, 0, "#e5484d"],
    [4, 0, "#e5484d"],
    [2, 1, "#e5484d"],
    [3, 1, "#ffdc2e"],
    [4, 1, "#e5484d"],
    [2, 2, "#e5484d"],
    [3, 2, "#ffdc2e"],
    [4, 2, "#e5484d"],
    [3, 3, "#3fa34d"],
    [4, 4, "#3fa34d"],
    [3, 4, "#3fa34d"],
    [3, 5, "#3fa34d"],
    [2, 5, "#3fa34d"],
    [3, 6, "#3fa34d"],
    [3, 7, "#3fa34d"],
  ];
  return (
    <svg
      width={14}
      height={16}
      viewBox="0 0 7 8"
      shapeRendering="crispEdges"
      aria-hidden
      style={{ position: "absolute", left: 84, top: -13 }}
    >
      {cells.map(([x, y, c]) => (
        <rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill={c} />
      ))}
    </svg>
  );
}

// Test bed for app.chrome: a custom title bar. The window manager hands the
// slot the drag protocol and the standard control cluster; spreading the
// pointer handlers onto the bar keeps the native drag feel.
export function BrowserTitleBar({
  title,
  focused,
  height,
  controls,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  onContextMenu,
}: AppTitleBarProps) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        position: "relative",
        height,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 10px",
        cursor: "grab",
        userSelect: "none",
        // The window opts into overflow: visible (the flower), so the frame
        // no longer clips this bar: it carries its own top corners to match
        // the window radius.
        borderRadius: "14px 14px 0 0",
        background: "rgba(20, 24, 28, 0.72)",
        color: "#f2f4f6",
        fontSize: 12,
        fontFamily: "inherit",
      }}
    >
      <PixelFlower />
      {controls}
      <span style={{ opacity: focused ? 1 : 0.6, fontWeight: 500 }}>{title}</span>
      <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.55 }}>
        custom chrome test
      </span>
    </div>
  );
}

// Minimal browser app: an address bar and an iframe. Whatever the target
// site's X-Frame-Options / CSP frame-ancestors headers allow, it renders in
// the window; anything that refuses framing (Google, GitHub...) shows the
// browser's block page. The "-> tab" button is the escape hatch for those.

const START = "https://codeberg.org";

function normalize(raw: string): string {
  const t = raw.trim();
  if (!t) return START;
  return /^[a-z]+:\/\//i.test(t) ? t : `https://${t}`;
}

export function BrowserContent() {
  const [input, setInput] = useState(START);
  const [src, setSrc] = useState(START);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "100%",
        minHeight: 0,
      }}
    >
      <form
        style={{ display: "flex", gap: 6, flexShrink: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          setSrc(normalize(input));
        }}
      >
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          spellCheck={false}
          placeholder="https://forgejo.example.com/…"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            fontFamily: "ui-monospace, monospace",
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid rgba(128,128,128,0.4)",
            background: "rgba(128,128,128,0.08)",
            color: "inherit",
            outline: "none",
          }}
        />
        <button type="submit" style={btn}>
          Go
        </button>
        <button
          type="button"
          title="Open in a real browser tab (for sites that refuse framing)"
          style={btn}
          onClick={() => {
            window.open(src, "_blank", "noopener");
          }}
        >
          {"->"} tab
        </button>
      </form>
      <iframe
        key={src}
        src={src}
        title="Browser viewport"
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          border: "1px solid rgba(128,128,128,0.35)",
          borderRadius: 6,
          background: "#fff",
        }}
      />
    </div>
  );
}

const btn: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.4)",
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontFamily: "inherit",
  cursor: "pointer",
};
