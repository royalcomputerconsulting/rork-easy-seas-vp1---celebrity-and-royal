import { useState, useEffect } from 'react';
import { InteractionManager, Platform } from 'react-native';

export function useDeferredRender(delay = 0): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => setIsReady(true), delay || 50);
      return () => clearTimeout(timer);
    }

    const interaction = InteractionManager.runAfterInteractions(() => {
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
