import React, { useRef, useCallback, ReactNode } from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, BORDER_RADIUS, SHADOW } from '@/constants/theme';

interface PressableCardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleOnPress?: number;
  hapticType?: 'light' | 'medium' | 'selection' | 'none';
  testID?: string;
}

export function PressableCard({
  children,
  onPress,
  style,
  disabled = false,
  scaleOnPress = 0.97,
  hapticType = 'light',
  testID,
}: PressableCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (Platform.OS !== 'web' && hapticType !== 'none') {
      if (hapticType === 'selection') {
        Haptics.selectionAsync().catch(() => {});
      } else {
        const style = hapticType === 'medium' 
          ? Haptics.ImpactFeedbackStyle.Medium 
          : Haptics.ImpactFeedbackStyle.Light;
        Haptics.impactAsync(style).catch(() => {});
      }
    }

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleOnPress,
        useNativeDriver: true,
        friction: 5,
        tension: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, scaleOnPress, hapticType]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 200,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  if (!onPress) {
    return (
      <Animated.View style={[styles.card, style]}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      style={[
        { 
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        disabled && styles.disabled,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
        testID={testID}
        style={[styles.card, style]}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

interface AnimatedIconButtonProps {
  children: ReactNode;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  hapticType?: 'light' | 'medium' | 'selection' | 'none';
  testID?: string;
}

export function AnimatedIconButton({
  children,
  onPress,
  size = 44,
  style,
  disabled = false,
  hapticType = 'light',
  testID,
}: AnimatedIconButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    if (Platform.OS !== 'web' && hapticType !== 'none') {
      if (hapticType === 'selection') {
        Haptics.selectionAsync().catch(() => {});
      } else {
        const impactStyle = hapticType === 'medium' 
          ? Haptics.ImpactFeedbackStyle.Medium 
          : Haptics.ImpactFeedbackStyle.Light;
        Haptics.impactAsync(impactStyle).catch(() => {});
      }
    }

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.85,
        useNativeDriver: true,
        friction: 5,
        tension: 400,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, rotateAnim, hapticType]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 3,
        tension: 200,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-5deg'],
  });

  return (
    <Animated.View 
      style={[
        { 
          transform: [{ scale: scaleAnim }, { rotate: rotation }],
        },
        disabled && styles.disabled,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
        testID={testID}
        style={[
          styles.iconButton,
          { width: size, height: size, borderRadius: size / 2 },
          style,
        ]}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOW.md,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  disabled: {
    opacity: 0.5,
  },
});
