// What each screen tells the voice guide about itself. Screens publish a small summary;
// the guide's session forwards it to the server, where the model can read it with a tool.
// Nothing is sent unless a voice conversation is open.

import { useEffect, useRef } from "react";

export type ContextKey = "player" | "facts" | "explore";
export type ContextUpdate = { key: ContextKey; data: unknown; announce?: string };
type Listener = (update: ContextUpdate) => void;

const current = new Map<ContextKey, unknown>();
const listeners = new Set<Listener>();

export function publishContext(key: ContextKey, data: unknown, announce?: string) {
  if (data === null) current.delete(key); else current.set(key, data);
  listeners.forEach(listener => listener({ key, data, announce }));
}

export function currentContext(): ContextUpdate[] {
  return [...current].map(([key, data]) => ({ key, data }));
}

export function subscribeContext(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Publish `data` whenever it changes, and clear it when the screen unmounts.
 * `announce` is only sent when it changes, so each milestone prompts feedback once.
 */
export function useAssistantContext(key: ContextKey, data: unknown, announce?: string, enabled = true) {
  const serialized = JSON.stringify(data ?? null);
  const lastAnnounce = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    const fresh = announce && announce !== lastAnnounce.current ? announce : undefined;
    lastAnnounce.current = announce;
    publishContext(key, data ?? null, fresh);
    // `serialized` stands in for `data`, so a new object with the same content does not republish.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, serialized, announce, enabled]);
  useEffect(() => () => publishContext(key, null), [key]);
}
