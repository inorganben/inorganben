import { useTheme } from "@benos/desktop";
import type { DemoThemeChoice } from "@benos/demo";
import { setThemeChoice, useThemeChoice } from "./theme-choice";

const CHOICES: { id: DemoThemeChoice; label: string }[] = [
  { id: "benos", label: "BenOS" },
  { id: "macos", label: "macOS" },
  { id: "windows", label: "Windows" },
  { id: "ubuntu", label: "Ubuntu" },
];

/** Compact theme picker: a quiet one-line control at the head of Settings. */
export function ThemePicker() {
  const theme = useTheme();
  const value = useThemeChoice();
  return (
    <div
      role="group"
      aria-label="Desktop theme"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12,
      }}
    >
      <span style={{ color: theme.palette.textSecondary }}>主题</span>
      {CHOICES.map((choice) => {
        const active = choice.id === value;
        return (
          <button
            key={choice.id}
            type="button"
            onClick={() => setThemeChoice(choice.id)}
            aria-pressed={active}
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              lineHeight: 1,
              padding: "2px 0",
              fontWeight: active ? 600 : 400,
              color: active ? theme.palette.accent : theme.palette.textSecondary,
              transition: `color ${theme.motion.dockHoverDurationMs}ms ease`,
            }}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
