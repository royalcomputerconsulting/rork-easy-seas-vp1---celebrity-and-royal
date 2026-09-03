import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { runAfterUiSettles } from '@/lib/runAfterUiSettles';

export function useDeferredRender(delay = 0): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => setIsReady(true), delay || 50);
      return () => clearTimeout(timer);
    }

    const interaction = runAfterUiSettles(() => {
      if (delay > 0) {
        setTimeout(() => setIsReady(true), delay);
      } else {
        setIsReady(true);
      }
    });

    return () => interaction.cancel();
  }, [delay]);

  return isReady;
}
