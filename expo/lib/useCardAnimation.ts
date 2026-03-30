import { useRef, useCallback } from 'react';
import { Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface UseCardAnimationOptions {
  scaleOnPress?: number;
  duration?: number;
  useHaptics?: boolean;
}

export function useCardAnimation(options: UseCardAnimationOptions = {}) {
  const {
    scaleOnPress = 0.97,
    duration = 100,
    useHaptics = true,
  } = options;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: scaleOnPress,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.9,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, scaleOnPress, duration]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, duration]);

  const triggerHaptic = useCallback(async () => {
    if (useHaptics && Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        console.log('[Haptics] Not available');
      }
    }
  }, [useHaptics]);

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
    opacity: opacityAnim,
  };

  return {
    scaleAnim,
    opacityAnim,
    animatedStyle,
    handlePressIn,
    handlePressOut,
    triggerHaptic,
  };
}

export function useLoadingPulse() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  return {
    pulseAnim,
    startPulse,
    stopPulse,
  };
}

export function useSlideIn(direction: 'left' | 'right' | 'up' | 'down' = 'up') {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const getTranslateKey = () => {
    switch (direction) {
      case 'left':
      case 'right':
        return 'translateX';
      default:
        return 'translateY';
    }
  };

  const animate = useCallback((delay = 0) => {
    const initialValue = (() => {
      switch (direction) {
        case 'left':
          return -50;
        case 'right':
          return 50;
        case 'down':
          return -30;
        default:
          return 30;
      }
    })();
    slideAnim.setValue(initialValue);
    fadeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim, direction]);

  const animatedStyle = {
    transform: [{ [getTranslateKey()]: slideAnim }],
    opacity: fadeAnim,
  };

  return {
    slideAnim,
    fadeAnim,
    animate,
    animatedStyle,
  };
}

export function useSuccessAnimation() {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const animate = useCallback(() => {
    scaleAnim.setValue(0);
    rotateAnim.setValue(0);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 100,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [scaleAnim, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const animatedStyle = {
    transform: [
      { scale: scaleAnim },
      { rotate: rotation },
    ],
  };

  return {
    scaleAnim,
    rotateAnim,
    animate,
    animatedStyle,
  };
}

export function useShakeAnimation() {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [shakeAnim]);

  const animatedStyle = {
    transform: [{ translateX: shakeAnim }],
  };

  return {
    shakeAnim,
    shake,
    animatedStyle,
  };
}
