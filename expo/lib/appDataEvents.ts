export type AppDataEventName = 'appDataCleared' | 'cloudDataRestored';

type Listener = () => void;
const listeners = new Map<AppDataEventName, Set<Listener>>();

export function subscribeToAppDataEvent(name: AppDataEventName, listener: Listener): () => void {
  const group = listeners.get(name) ?? new Set<Listener>();
  group.add(listener);
  listeners.set(name, group);
  return () => group.delete(listener);
}

/** Cross-platform provider refresh signal. The DOM event is retained for web compatibility. */
export function emitAppDataEvent(name: AppDataEventName): void {
  listeners.get(name)?.forEach((listener) => {
    try { listener(); } catch (error) { console.warn(`[AppDataEvents] ${name} listener failed`, error); }
  });
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(name));
    }
  } catch (error) {
    console.warn(`[AppDataEvents] ${name} DOM dispatch failed`, error);
  }
}
