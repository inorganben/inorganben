// Formatting and expression evaluation for the calculator. The display keeps
// the whole expression the user typed; "=" evaluates it with the usual
// precedence (×, ÷ before +, −) so 1 + 2 × 3 is 7, not the macOS basic-mode 9.

export const ADD = "+";
export const SUB = "−";
export const MUL = "×";
export const DIV = "÷";

export function isOperator(token: string | undefined): boolean {
  return token === ADD || token === SUB || token === MUL || token === DIV;
}

const PLAIN = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  useGrouping: false,
});
const GROUPED = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/** Canonical number string (raw, re-parseable, no grouping). */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "Not a number";
  if (value === 0) return "0";

  const abs = Math.abs(value);
  if (abs >= 1e15 || (abs < 1e-6 && abs > 0)) {
    return value.toExponential(6).replace(/\.?0+e/, "e");
  }

  const rounded = Number(value.toPrecision(12));
  let out = String(rounded);
  if (out.includes("e")) {
    out = rounded.toExponential(6).replace(/\.?0+e/, "e");
  }
  return out;
}

/** Presentation formatter: group the integer part, keep the typed decimals. */
export function formatForDisplay(raw: string): string {
  if (raw === "Not a number" || raw.includes("e")) return raw;

  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [intPart = "0", ...rest] = body.split(".");
  const hasDot = body.includes(".");
  const decPart = rest.join("");

  const intNum = Number(intPart);
  const groupedInt = Number.isFinite(intNum) ? GROUPED.format(intNum) : PLAIN.format(0);

  let result = groupedInt;
  if (hasDot) result += "." + decPart;
  return negative ? "-" + result : result;
}

/**
 * Evaluate an alternating number/operator token list with precedence: a first
 * pass folds × and ÷, a second pass folds + and −, both left to right.
 */
export function evaluateTokens(tokens: string[]): number {
  const work = tokens.slice();

  for (let i = 1; i < work.length - 1; i += 2) {
    const op = work[i];
    if (op !== MUL && op !== DIV) continue;
    const a = Number(work[i - 1]);
    const b = Number(work[i + 1]);
    work.splice(i - 1, 3, String(op === MUL ? a * b : a / b));
    i -= 2;
  }

  let acc = Number(work[0]);
  for (let i = 1; i < work.length - 1; i += 2) {
    const b = Number(work[i + 1]);
    acc = work[i] === ADD ? acc + b : acc - b;
  }
  return acc;
}
