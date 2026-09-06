import { useSyncExternalStore } from "react";
import {
  persistThemeChoice,
  readInitialThemeChoice,
  type DemoThemeChoice,
} from "@benos/demo";

// Module-level store (the library's imperative-store pattern, playground
// scope): App builds the theme from it, the Settings window writes it from
// the system-window registry, outside App's React tree.
let current: DemoThemeChoice | null = null;
const listeners = new Set<() => void>();

function get(): DemoThemeChoice {
  if (current === null) current = readInitialThemeChoice();
  return current;
}

export function setThemeChoice(choice: DemoThemeChoice): void {
  if (choice === current) return;
  current = choice;
  persistThemeChoice(choice);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useThemeChoice(): DemoThemeChoice {
  return useSyncExternalStore(subscribe, get, get);
}
