import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, X, Ship, FileUp, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

interface QuickActionsFABProps {
  onBrowseCruises?: () => void;
  onImportData?: () => void;
  onViewCalendar?: () => void;
}

export function QuickActionsFAB({
  onBrowseCruises,
  onImportData,
  onViewCalendar,
}: QuickActionsFABProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const triggerHaptic = useCallback(async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        console.log('[QuickActionsFAB] Haptic not available');
      }
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    const newExpanded = !isExpanded;
    triggerHaptic();
    
    Animated.parallel([
      Animated.spring(rotateAnim, {
        toValue: newExpanded ? 1 : 0,
        useNativeDriver: true,
        friction: 6,
      }),
      Animated.spring(scaleAnim, {
        toValue: newExpanded ? 1 : 0,
        useNativeDriver: true,
        friction: 6,
      }),
      Animated.timing(fadeAnim, {
        toValue: newExpanded ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    setIsExpanded(newExpanded);
    console.log('[QuickActionsFAB] Toggled:', newExpanded);
  }, [isExpanded, rotateAnim, scaleAnim, fadeAnim, triggerHaptic]);

  const handleActionPress = useCallback((action?: () => void) => {
    triggerHaptic();
    toggleExpanded();
    if (action) {
      setTimeout(() => action(), 150);
    }
  }, [toggleExpanded, triggerHaptic]);

  const actions: QuickAction[] = [
    {
      id: 'browse',
      label: 'Browse Cruises',
      icon: <Ship size={20} color={COLORS.white} />,
      color: COLORS.points,
      onPress: () => handleActionPress(onBrowseCruises),
    },
    {
      id: 'import',
      label: 'Import Data',
      icon: <FileUp size={20} color={COLORS.white} />,
      color: COLORS.gold,
      onPress: () => handleActionPress(onImportData),
    },
    {
      id: 'calendar',
      label: 'View Calendar',
      icon: <Calendar size={20} color={COLORS.white} />,
      color: COLORS.money,
      onPress: () => handleActionPress(onViewCalendar),
    },
  ];

  const iconRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '135deg'],
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {isExpanded && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={toggleExpanded}
        />
      )}
      
      <Animated.View
        style={[
          styles.actionsContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
        pointerEvents={isExpanded ? 'auto' : 'none'}
      >
        {actions.map((action, index) => (
          <Animated.View
            key={action.id}
            style={[
              styles.actionItem,
              {
                transform: [
                  {
                    translateY: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.actionLabelContainer}
              onPress={action.onPress}
              activeOpacity={0.8}
            >
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: action.color }]}
              onPress={action.onPress}
              activeOpacity={0.8}
            >
              {action.icon}
            </TouchableOpacity>
          </Animated.View>
        ))}
      </Animated.View>

      <TouchableOpacity
        style={styles.fabButton}
        onPress={toggleExpanded}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={isExpanded ? ['#EF4444', '#DC2626'] : [COLORS.textNavy, COLORS.navy]}
          style={styles.fabGradient}
        >
          <Animated.View style={{ transform: [{ rotate: iconRotation }] }}>
            {isExpanded ? (
              <X size={24} color={COLORS.white} />
            ) : (
              <Plus size={24} color={COLORS.white} />
            )}
          </Animated.View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    right: SPACING.md,
    alignItems: 'flex-end',
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -100,
    bottom: -100,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionsContainer: {
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  actionLabelContainer: {
    backgroundColor: 'rgba(0, 31, 63, 0.95)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.sm,
    ...SHADOW.md,
  },
  actionLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.white,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.lg,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...SHADOW.xl,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
