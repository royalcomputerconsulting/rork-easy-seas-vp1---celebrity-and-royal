import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle,
  Target,
  TrendingUp,
  Zap,
  Trophy,
  Flame,
  Clock,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

export type PPHAlertType = 
  | 'target_reached'
  | 'target_exceeded' 
  | 'below_target'
  | 'milestone'
  | 'new_record'
  | 'pace_warning'
  | 'time_milestone'
  | 'streak_achieved';

export interface PPHAlertData {
  id: string;
  type: PPHAlertType;
  title: string;
  message: string;
  value?: number;
  timestamp: number;
}

interface PPHAlertNotificationProps {
  alert: PPHAlertData;
  onDismiss: (id: string) => void;
  autoHideDuration?: number;
}

const ALERT_CONFIGS: Record<PPHAlertType, {
  icon: React.ReactNode;
  gradientColors: [string, string];
  textColor: string;
  haptic: 'success' | 'warning' | 'error' | 'none';
}> = {
  target_reached: {
    icon: <Target size={20} color="#FFFFFF" />,
    gradientColors: ['#10B981', '#059669'],
    textColor: '#FFFFFF',
    haptic: 'success',
  },
  target_exceeded: {
    icon: <Trophy size={20} color="#FFFFFF" />,
    gradientColors: ['#F59E0B', '#D97706'],
    textColor: '#FFFFFF',
    haptic: 'success',
  },
  below_target: {
    icon: <AlertTriangle size={20} color="#FFFFFF" />,
    gradientColors: ['#EF4444', '#DC2626'],
    textColor: '#FFFFFF',
    haptic: 'warning',
  },
  milestone: {
    icon: <Zap size={20} color="#FFFFFF" />,
    gradientColors: ['#8B5CF6', '#7C3AED'],
    textColor: '#FFFFFF',
    haptic: 'success',
  },
  new_record: {
    icon: <Flame size={20} color="#FFFFFF" />,
    gradientColors: ['#F97316', '#EA580C'],
    textColor: '#FFFFFF',
    haptic: 'success',
  },
  pace_warning: {
    icon: <TrendingUp size={20} color="#FFFFFF" />,
    gradientColors: ['#F59E0B', '#B45309'],
    textColor: '#FFFFFF',
    haptic: 'warning',
  },
  time_milestone: {
    icon: <Clock size={20} color="#FFFFFF" />,
    gradientColors: ['#3B82F6', '#2563EB'],
    textColor: '#FFFFFF',
    haptic: 'success',
  },
  streak_achieved: {
    icon: <CheckCircle size={20} color="#FFFFFF" />,
    gradientColors: ['#06B6D4', '#0891B2'],
    textColor: '#FFFFFF',
    haptic: 'success',
  },
};

export function PPHAlertNotification({
  alert,
  onDismiss,
  autoHideDuration = 5000,
}: PPHAlertNotificationProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const config = ALERT_CONFIGS[alert.type];

  useEffect(() => {
    if (Platform.OS !== 'web' && config.haptic !== 'none') {
      switch (config.haptic) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: 100,
      duration: autoHideDuration,
      useNativeDriver: false,
    }).start();

    const timeout = setTimeout(() => {
      onDismiss(alert.id);
    }, autoHideDuration);

    return () => clearTimeout(timeout);
  }, [translateY, opacity, scale, progressAnim, autoHideDuration, config.haptic, alert.id, onDismiss]);

  const handleDismiss = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(alert.id);
    });
  }, [translateY, opacity, alert.id, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <View
        style={[
          styles.alertCard,
          { backgroundColor: config.gradientColors[0] },
        ]}
      >
        <View style={styles.iconContainer}>
          {config.icon}
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={styles.message}>{alert.message}</Text>
          {alert.value !== undefined && (
            <View style={styles.valueContainer}>
              <Text style={styles.valueText}>{alert.value.toFixed(0)}</Text>
              <Text style={styles.valueUnit}>pts/hr</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
        >
          <X size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

interface PPHAlertContainerProps {
  alerts: PPHAlertData[];
  onDismissAlert: (id: string) => void;
}

export function PPHAlertContainer({ alerts, onDismissAlert }: PPHAlertContainerProps) {
  return (
    <View style={styles.containerWrapper}>
      {alerts.slice(0, 3).map((alert, index) => (
        <View key={alert.id} style={{ marginTop: index * 8 }}>
          <PPHAlertNotification
            alert={alert}
            onDismiss={onDismissAlert}
          />
        </View>
      ))}
    </View>
  );
}

export function createPPHAlert(
  type: PPHAlertType,
  title: string,
  message: string,
  value?: number
): PPHAlertData {
  return {
    id: `pph_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    message,
    value,
    timestamp: Date.now(),
  };
}

export const PPH_ALERT_PRESETS = {
  targetReached: (pph: number, target: number) => createPPHAlert(
    'target_reached',
    '🎯 Target Reached!',
    `You hit your ${target} pts/hr target!`,
    pph
  ),
  targetExceeded: (pph: number, target: number, percent: number) => createPPHAlert(
    'target_exceeded',
    '🏆 Exceeding Target!',
    `${percent.toFixed(0)}% above your ${target} pts/hr goal!`,
    pph
  ),
  belowTarget: (pph: number, target: number) => createPPHAlert(
    'below_target',
    '⚠️ Below Target',
    `Currently at ${pph.toFixed(0)} pts/hr, target is ${target}`,
    pph
  ),
  pointsMilestone: (points: number) => createPPHAlert(
    'milestone',
    '⚡ Points Milestone!',
    `You've earned ${points.toLocaleString()} points this session!`
  ),
  newRecord: (pph: number, previousBest: number) => createPPHAlert(
    'new_record',
    '🔥 New Personal Record!',
    `${pph.toFixed(0)} pts/hr beats your previous best of ${previousBest.toFixed(0)}!`,
    pph
  ),
  paceWarning: (pph: number) => createPPHAlert(
    'pace_warning',
    '📉 Pace Slowing',
    `Your earning rate has dropped to ${pph.toFixed(0)} pts/hr`,
    pph
  ),
  timeMilestone: (hours: number) => createPPHAlert(
    'time_milestone',
    '⏰ Time Milestone',
    `You've been playing for ${hours.toFixed(1)} hours!`
  ),
  streakAchieved: (days: number) => createPPHAlert(
    'streak_achieved',
    '🔄 Streak Achieved!',
    `${days} day tracking streak! Keep it up!`
  ),
};

const styles = StyleSheet.create({
  containerWrapper: {
    position: 'absolute',
    top: 50,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 1000,
  },
  container: {
    width: '100%',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    paddingRight: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  message: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: SPACING.xs,
    gap: 4,
  },
  valueText: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  valueUnit: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dismissButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});
