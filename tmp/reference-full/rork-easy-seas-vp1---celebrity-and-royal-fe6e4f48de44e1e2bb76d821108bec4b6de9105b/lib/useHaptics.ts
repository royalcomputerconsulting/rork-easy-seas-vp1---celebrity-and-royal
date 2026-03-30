import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type HapticType = 
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error'
  | 'rigid'
  | 'soft';

const hapticMap: Record<HapticType, () => Promise<void>> = {
  light: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  medium: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  heavy: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  selection: async () => {
    await Haptics.selectionAsync();
  },
  success: async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning: async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  error: async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  rigid: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  },
  soft: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  },
};

export function useHaptics() {
  const trigger = useCallback(async (type: HapticType = 'light') => {
    if (Platform.OS === 'web') {
      console.log(`[Haptics] ${type} feedback (web - not available)`);
      return;
    }
    
    try {
      await hapticMap[type]();
    } catch (error) {
      console.log('[Haptics] Failed to trigger haptic feedback:', error);
    }
  }, []);

  const buttonPress = useCallback(() => trigger('light'), [trigger]);
  const tabPress = useCallback(() => trigger('selection'), [trigger]);
  const success = useCallback(() => trigger('success'), [trigger]);
  const warning = useCallback(() => trigger('warning'), [trigger]);
  const error = useCallback(() => trigger('error'), [trigger]);
  const swipe = useCallback(() => trigger('soft'), [trigger]);
  const tierAchievement = useCallback(() => trigger('success'), [trigger]);
  const jackpot = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 100);
      setTimeout(async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 200);
    } catch (err) {
      console.log('[Haptics] Jackpot sequence failed:', err);
    }
  }, []);

  const slotSpin = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      for (let i = 0; i < 3; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    } catch (err) {
      console.log('[Haptics] Slot spin failed:', err);
    }
  }, []);

  return {
    trigger,
    buttonPress,
    tabPress,
    success,
    warning,
    error,
    swipe,
    tierAchievement,
    jackpot,
    slotSpin,
  };
}

export async function triggerHaptic(type: HapticType = 'light') {
  if (Platform.OS === 'web') return;
  
  try {
    await hapticMap[type]();
  } catch (error) {
    console.log('[Haptics] Failed to trigger haptic feedback:', error);
  }
}
