import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { App, AppContentProps, AppTitleBarProps } from "@benos/core";
import { useWindowManager } from "@benos/core";
import { registerSystemWindow, useTheme } from "@benos/desktop";
import { pngIcon } from "@benos/demo";
import {
  ADD,
  DIV,
  MUL,
  SUB,
  evaluateTokens,
  formatForDisplay,
  formatNumber,
  isOperator,
} from "./engine";

// The calculator keeps its own macOS Calculator skin: a fixed dark palette
// independent of the desktop theme, so it reads the same on every surface.
const BG = "#1c1c1e";
const KEY_FN = "#5a5a5e";
const KEY_DIGIT = "#333336";
const KEY_OP = "#ff9f0a";
const TEXT = "#ffffff";
const ICON = `${import.meta.env.BASE_URL}icon/calc.png`;
const DEFAULT_ICON = `${import.meta.env.BASE_URL}icon/default.png`;

type Operator = "add" | "subtract" | "multiply" | "divide";

const OP_GLYPH: Record<Operator, string> = {
  add: ADD,
  subtract: SUB,
  multiply: MUL,
  divide: DIV,
};

type Action =
  | { type: "digit"; digit: string }
  | { type: "decimal" }
  | { type: "operator"; operator: Operator }
  | { type: "equals" }
  | { type: "negate" }
  | { type: "percent" }
  | { type: "clear" }
  | { type: "delete" };

interface Model {
  /** Alternating number/operator tokens, e.g. ["1","+","2","×","3"]. */
  tokens: string[];
  /** True right after "=": the next digit starts a new expression. */
  evaluated: boolean;
}

const initialModel: Model = { tokens: [], evaluated: false };

/**
 * The display keeps the whole expression; nothing is collapsed or evaluated
 * until "=" is pressed. Number tokens are raw strings ("0.", "-3") that get
 * grouped for display and parsed for evaluation.
 */
function apply(model: Model, action: Action): Model {
  const { tokens, evaluated } = model;
  const last = tokens.length > 0 ? tokens[tokens.length - 1] : undefined;

  switch (action.type) {
    case "digit": {
      if (evaluated) return { tokens: [action.digit], evaluated: false };
      if (last === undefined || isOperator(last)) {
        return { tokens: [...tokens, action.digit], evaluated: false };
      }
      const next = last === "0" ? action.digit : last + action.digit;
      return { tokens: [...tokens.slice(0, -1), next], evaluated: false };
    }
    case "decimal": {
      if (evaluated) return { tokens: ["0."], evaluated: false };
      if (last === undefined || isOperator(last)) {
        return { tokens: [...tokens, "0."], evaluated: false };
      }
      if (last.includes(".")) return model;
      return { tokens: [...tokens.slice(0, -1), last + "."], evaluated: false };
    }
    case "operator": {
      if (tokens.length === 0) return model;
      const glyph = OP_GLYPH[action.operator];
      if (last !== undefined && isOperator(last)) {
        return { tokens: [...tokens.slice(0, -1), glyph], evaluated: false };
      }
      return { tokens: [...tokens, glyph], evaluated: false };
    }
    case "equals": {
      const expr = isOperator(last) ? tokens.slice(0, -1) : tokens;
      if (expr.length === 0) return model;
      return { tokens: [formatNumber(evaluateTokens(expr))], evaluated: true };
    }
    case "negate": {
      if (last === undefined || isOperator(last)) return model;
      const negated = last.startsWith("-") ? last.slice(1) : `-${last}`;
      return { tokens: [...tokens.slice(0, -1), negated], evaluated: false };
    }
    case "percent": {
      if (last === undefined || isOperator(last)) return model;
      const value = Number(last) / 100;
      return {
        tokens: [...tokens.slice(0, -1), formatNumber(value)],
        evaluated: false,
      };
    }
    case "clear": {
      // C clears the current entry; AC (nothing being typed) wipes everything.
      if (!evaluated && last !== undefined && !isOperator(last)) {
        return { tokens: tokens.slice(0, -1), evaluated: false };
      }
      return initialModel;
    }
    case "delete": {
      if (evaluated || tokens.length === 0) return initialModel;
      if (last === undefined || isOperator(last)) {
        return { tokens: tokens.slice(0, -1), evaluated: false };
      }
      const trimmed = last.slice(0, -1);
      if (trimmed === "" || trimmed === "-") {
        return { tokens: tokens.slice(0, -1), evaluated: false };
      }
      return { tokens: [...tokens.slice(0, -1), trimmed], evaluated: false };
    }
  }
}

/* ── chrome icons ───────────────────────────────────────────── */

function BackspaceIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-5-7z" />
      <path d="m12 9 5 6M17 9l-5 6" />
    </svg>
  );
}

/* ── custom title bar ───────────────────────────────────────── */

function CalcTitleBar(p: AppTitleBarProps) {
  const theme = useTheme();
  const traffic = theme.chrome.windowControls === "traffic-lights";
  return (
    <div
      onPointerDown={p.onPointerDown}
      onPointerMove={p.onPointerMove}
      onPointerUp={p.onPointerUp}
      onPointerCancel={p.onPointerCancel}
      onDoubleClick={p.onDoubleClick}
      onContextMenu={p.onContextMenu}
      style={{
        position: "relative",
        height: p.height,
        display: "flex",
        alignItems: "center",
        justifyContent: traffic ? "space-between" : "flex-end",
        gap: 8,
        paddingLeft: traffic ? 10 : 12,
        paddingRight: 12,
        background: BG,
        userSelect: "none",
        cursor: "grab",
        flexShrink: 0,
      }}
    >
      {traffic && p.controls}
      <span style={{ flex: 1 }} aria-hidden />
      {!traffic && p.controls}
    </div>
  );
}

/* ── keypad ─────────────────────────────────────────────────── */

const KEY_STYLE = `
.bc-root{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif}
.bc-display{flex:1 1 auto;min-height:0;display:flex;align-items:flex-end;justify-content:flex-end;padding:16px 22px 6px;overflow:hidden}
.bc-num{font-size:52px;font-weight:300;line-height:1.05;font-variant-numeric:tabular-nums;white-space:nowrap;transform-origin:right center;color:${TEXT}}
.bc-pad{flex:0 0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:12px 18px 18px}
.bc-key{appearance:none;border:0;border-radius:50%;aspect-ratio:1;min-width:0;padding:0;display:flex;align-items:center;justify-content:center;font-family:inherit;font-size:25px;font-weight:400;line-height:1;color:${TEXT};background:${KEY_DIGIT};cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;transition:filter .12s ease,background .12s ease,color .12s ease}
.bc-key:hover{filter:brightness(1.28)}
.bc-key:active{filter:brightness(1.55)}
.bc-key.fn{background:${KEY_FN}}
.bc-key.op{background:${KEY_OP}}
.bc-key.op.active{background:${TEXT};color:${KEY_OP}}
.bc-key.small{font-size:21px}
`;

function Key({
  variant,
  active,
  ariaLabel,
  onClick,
  children,
  small,
}: {
  variant: "fn" | "digit" | "op";
  active?: boolean;
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={variant === "op" ? active : undefined}
      onClick={onClick}
      className={`bc-key ${variant}${active ? " active" : ""}${small ? " small" : ""}`}
    >
      {children}
    </button>
  );
}

/* ── hidden easter eggs ─────────────────────────────────────── */

// 1122 → full-screen rain for five seconds. Portaled to <body> so it covers
// the whole desktop, not just the calculator window.
const RAIN_STYLE = `
.bc-rain{position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden;background:linear-gradient(rgba(120,150,190,.10),rgba(80,110,150,.18));animation:bc-rain-fade 5s ease forwards}
.bc-drop{position:absolute;top:-14vh;width:1.5px;border-radius:2px;background:linear-gradient(to bottom,rgba(205,228,255,0),rgba(205,228,255,.8));animation-name:bc-rain-fall;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes bc-rain-fall{from{transform:translateY(0) rotate(8deg)}to{transform:translateY(130vh) rotate(8deg)}}
@keyframes bc-rain-fade{0%{opacity:0}8%{opacity:1}88%{opacity:1}100%{opacity:0}}
`;

// Deterministic pseudo-random so the drop field is stable across renders and
// the component stays pure (no Math.random during render).
function rainRand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function Rain() {
  const drops = useMemo(
    () =>
      Array.from({ length: 140 }, (_, i) => ({
        left: rainRand(i, 1) * 100,
        delay: rainRand(i, 2) * 1.4,
        duration: 0.65 + rainRand(i, 3) * 0.7,
        height: 34 + rainRand(i, 4) * 68,
        opacity: 0.16 + rainRand(i, 5) * 0.42,
      })),
    [],
  );
  return createPortal(
    <div className="bc-rain" aria-hidden>
      <style>{RAIN_STYLE}</style>
      {drops.map((drop, i) => (
        <span
          key={i}
          className="bc-drop"
          style={{
            left: `${drop.left}vw`,
            height: drop.height,
            opacity: drop.opacity,
            animationDelay: `${drop.delay}s`,
            animationDuration: `${drop.duration}s`,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}

// 616 → a little birthday window. Registered lazily so it never shows up in
// Spotlight or any launcher until the egg is actually triggered.
function BirthdayContent() {
  const theme = useTheme();
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        placeItems: "center",
        padding: 16,
        boxSizing: "border-box",
        textAlign: "center",
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: theme.palette.textPrimary,
      }}
    >
      恭喜一个废物诞生了
    </div>
  );
}

let birthdayRegistered = false;
function openBirthdayWindow(): void {
  if (!birthdayRegistered) {
    birthdayRegistered = true;
    registerSystemWindow("calc-birthday", {
      name: "",
      accent: "#ff9f0a",
      defaultBounds: { w: 360, h: 190 },
      content: BirthdayContent,
      icon: pngIcon(DEFAULT_ICON),
      iconFormat: "macgrid",
    });
  }
}

/* ── app content ────────────────────────────────────────────── */

function CalcContent({ focused }: AppContentProps) {
  const [model, setModel] = useState<Model>(initialModel);
  const [rain, setRain] = useState(false);
  const displayRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { openWindow } = useWindowManager();

  const press = useCallback(
    (action: Action) => {
      if (action.type === "equals" && model.tokens.length === 1) {
        const value = model.tokens[0];
        if (value === "1122") setRain(true);
        else if (value === "616") {
          openBirthdayWindow();
          openWindow({ kind: "system", systemId: "calc-birthday" });
        }
      }
      setModel((current) => apply(current, action));
    },
    [model.tokens, openWindow],
  );

  useEffect(() => {
    if (!rain) return;
    const timer = window.setTimeout(() => setRain(false), 5000);
    return () => window.clearTimeout(timer);
  }, [rain]);

  const { tokens, evaluated } = model;
  const expression =
    tokens.length === 0
      ? "0"
      : tokens
          .map((token) => (isOperator(token) ? token : formatForDisplay(token)))
          .join(" ");
  const hasEntry =
    tokens.length > 0 && !isOperator(tokens[tokens.length - 1]) && !evaluated;
  const clearLabel = hasEntry ? "C" : "AC";
  const activeOperator =
    !evaluated && tokens.length > 0 && isOperator(tokens[tokens.length - 1])
      ? tokens[tokens.length - 1]
      : null;

  useEffect(() => {
    const el = displayRef.current;
    if (typeof window === "undefined" || el === null) return;
    const parent = el.parentElement;
    if (parent === null) return;
    el.style.transform = "scale(1)";
    const available = parent.clientWidth - 44;
    const needed = el.scrollWidth;
    setScale(needed > available && needed > 0 ? Math.max(0.42, available / needed) : 1);
  }, [expression]);

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      const { key } = event;
      if (key >= "0" && key <= "9") press({ type: "digit", digit: key });
      else if (key === "." || key === ",") press({ type: "decimal" });
      else if (key === "+") press({ type: "operator", operator: "add" });
      else if (key === "-")
        press(
          event.altKey
            ? { type: "negate" }
            : { type: "operator", operator: "subtract" },
        );
      else if (key === "*") press({ type: "operator", operator: "multiply" });
      else if (key === "/") {
        event.preventDefault();
        press({ type: "operator", operator: "divide" });
      } else if (key === "=" || key === "Enter") {
        event.preventDefault();
        press({ type: "equals" });
      } else if (key === "%") press({ type: "percent" });
      else if (key === "Escape" || key === "c" || key === "C") press({ type: "clear" });
      else if (key === "Backspace" || key === "Delete") press({ type: "delete" });
      else if (key === "n" || key === "_") press({ type: "negate" });
      else return;
    },
    [press],
  );

  useEffect(() => {
    if (!focused || typeof window === "undefined") return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [focused, handleKey]);

  const op = (operator: Operator, glyph: string) => (
    <Key
      key={operator}
      variant="op"
      active={activeOperator === glyph}
      ariaLabel={operator}
      onClick={() => press({ type: "operator", operator })}
    >
      {glyph}
    </Key>
  );

  const digit = (d: string) => (
    <Key
      key={d}
      variant="digit"
      ariaLabel={d}
      onClick={() => press({ type: "digit", digit: d })}
    >
      {d}
    </Key>
  );

  return (
    <div
      className="bc-root"
      style={{
        margin: -16,
        width: "calc(100% + 32px)",
        height: "calc(100% + 32px)",
        boxSizing: "border-box",
        background: BG,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <style>{KEY_STYLE}</style>
      {rain && <Rain />}

      <div className="bc-display">
        <div
          ref={displayRef}
          role="status"
          aria-live="polite"
          aria-label={`表达式 ${expression}`}
          className="bc-num"
          style={{ transform: `scale(${scale})` }}
        >
          {expression}
        </div>
      </div>

      <div className="bc-pad" role="group" aria-label="计算器键盘">
        <Key variant="fn" ariaLabel="删除" onClick={() => press({ type: "delete" })}>
          <BackspaceIcon />
        </Key>
        <Key
          variant="fn"
          ariaLabel={hasEntry ? "清除当前" : "全部清除"}
          onClick={() => press({ type: "clear" })}
        >
          {clearLabel}
        </Key>
        <Key variant="fn" ariaLabel="百分比" onClick={() => press({ type: "percent" })}>
          %
        </Key>
        {op("divide", DIV)}

        {digit("7")}
        {digit("8")}
        {digit("9")}
        {op("multiply", MUL)}

        {digit("4")}
        {digit("5")}
        {digit("6")}
        {op("subtract", SUB)}

        {digit("1")}
        {digit("2")}
        {digit("3")}
        {op("add", ADD)}

        <Key
          variant="digit"
          small
          ariaLabel="正负号"
          onClick={() => press({ type: "negate" })}
        >
          +/−
        </Key>
        {digit("0")}
        <Key
          variant="digit"
          ariaLabel="小数点"
          onClick={() => press({ type: "decimal" })}
        >
          .
        </Key>
        <Key variant="op" ariaLabel="等于" onClick={() => press({ type: "equals" })}>
          =
        </Key>
      </div>
    </div>
  );
}

export const calcApp: App = {
  id: "calc",
  name: "计算器",
  tagline: "像 macOS 的计算器",
  accent: "#ff9f0a",
  icon: pngIcon(ICON),
  iconFormat: "macgrid",
  defaultBounds: { w: 320, h: 580 },
  content: CalcContent,
  chrome: { titleBar: CalcTitleBar, border: "none" },
};
