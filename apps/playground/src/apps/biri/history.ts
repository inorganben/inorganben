// Biri keeps its chat history in localStorage so the card wall and every past
// conversation survive a reload or a closed window. One flat list, newest
// first; the first user message becomes the card title.
import type { ModelKind } from "./model";

export interface ChatMsg {
  from: "user" | "ai";
  text: string;
}

export interface Session {
  id: string;
  title: string;
  model: ModelKind;
  msgs: ChatMsg[];
  updatedAt: number;
}

const KEY = "biri.sessions";
const NEW = "新对话";

function read(): Session[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch {
    return [];
  }
}

function persist(sessions: Session[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions));
  } catch {
    // Quota or private mode: history simply won't survive this session.
  }
}

let cache: Session[] = read();
const listeners = new Set<() => void>();

function setAll(next: Session[]): void {
  cache = next;
  persist(next);
  listeners.forEach((l) => l());
}

export function getSessions(): Session[] {
  return cache;
}

export function subscribeHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(model: ModelKind): Session {
  const s: Session = {
    id: newId(),
    title: NEW,
    model,
    msgs: [],
    updatedAt: Date.now(),
  };
  setAll([s, ...cache]);
  return s;
}

export function appendMsg(id: string, msg: ChatMsg): void {
  setAll(
    cache.map((s) => {
      if (s.id !== id) return s;
      const title =
        s.title === NEW && msg.from === "user" ? msg.text.slice(0, 24) : s.title;
      return { ...s, msgs: [...s.msgs, msg], title, updatedAt: Date.now() };
    }),
  );
}

export function setModel(id: string, model: ModelKind): void {
  setAll(cache.map((s) => (s.id === id ? { ...s, model, updatedAt: Date.now() } : s)));
}

export function deleteSession(id: string): void {
  setAll(cache.filter((s) => s.id !== id));
}
