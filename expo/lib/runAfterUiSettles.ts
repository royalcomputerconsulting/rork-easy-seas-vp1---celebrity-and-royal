import * as ReactNative from 'react-native';

export interface UiSettledTask {
  cancel: () => void;
}

/**
 * Runs work after active native interactions when React Native exposes
 * InteractionManager, and falls back to a short timer in runtimes/builds where
 * InteractionManager is unavailable. This keeps heavy screens from crashing
 * just because the scheduler API is missing.
 */
export function runAfterUiSettles(callback: () => void, fallbackDelayMs = 0): UiSettledTask {
  // InteractionManager is deprecated and is absent from some newer React
  // Native runtimes. Access it through the namespace so importing this helper
  // never requires the property to exist; the bounded timer below remains the
  // supported fallback on those runtimes.
  const manager = (ReactNative as unknown as {
    InteractionManager?: {
      runAfterInteractions?: (work: () => void) => { cancel?: () => void } | void;
    };
  }).InteractionManager as {
    runAfterInteractions?: (work: () => void) => { cancel?: () => void } | void;
  } | undefined;

  if (manager?.runAfterInteractions) {
    const task = manager.runAfterInteractions(callback);
    return {
      cancel: () => {
        if (task && typeof task.cancel === 'function') {
          task.cancel();
        }
      },
    };
  }

  const timer = setTimeout(callback, fallbackDelayMs);
  return {
    cancel: () => clearTimeout(timer),
  };
}
