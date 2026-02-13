export function safeDispatchEvent(eventName: string, detail?: Record<string, unknown>): void {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(detail ? new CustomEvent(eventName, { detail }) : new CustomEvent(eventName));
      console.log(`[SafeEvent] Dispatched: ${eventName}`);
    }
  } catch (error) {
    console.log(`[SafeEvent] Could not dispatch ${eventName} (not supported in this environment)`);
  }
}

export function safeAddEventListener(eventName: string, handler: EventListener): (() => void) | undefined {
  try {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener(eventName, handler);
      return () => {
        window.removeEventListener(eventName, handler);
      };
    }
  } catch (error) {
    console.log(`[SafeEvent] Could not add listener for ${eventName}`);
  }
  return undefined;
}
