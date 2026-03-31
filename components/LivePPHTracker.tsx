import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  Award,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { formatNumber } from '@/lib/format';
import { usePPHAlerts } from '@/state/PPHAlertsProvider';


interface LivePPHTrackerProps {
  targetPPH?: number;
  onSessionComplete?: (data: {
    durationMinutes: number;
    pointsEarned: number;
    pph: number;
  }) => void;
  historicalAvgPPH?: number;
  compact?: boolean;
}

type AlertType = 'below_target' | 'above_target' | 'pace_warning' | 'milestone';

interface PPHAlert {
  type: AlertType;
  message: string;
  color: string;
}

export function LivePPHTracker({
  targetPPH = 100,
  onSessionComplete,
  historicalAvgPPH = 0,
  compact = false,
}: LivePPHTrackerProps) {
  const { checkAndTriggerAlerts, setPersonalBestPPH } = usePPHAlerts();
  const [isTracking, setIsTracking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [currentPPH, setCurrentPPH] = useState(0);
  const [alerts, setAlerts] = useState<PPHAlert[]>([]);
  const [milestoneReached, setMilestoneReached] = useState<number[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const alertAnim = useRef(new Animated.Value(0)).current;
  const lastAlertCheckRef = useRef(0);

  const elapsedMinutes = useMemo(() => elapsedSeconds / 60, [elapsedSeconds]);
  const elapsedHours = useMemo(() => elapsedSeconds / 3600, [elapsedSeconds]);

  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const stopPulseAnimation = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const showAlertAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(alertAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(alertAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [alertAnim]);

  useEffect(() => {
    if (elapsedMinutes > 0) {
      const pph = (pointsEarned / elapsedMinutes) * 60;
      setCurrentPPH(pph);

      const progress = Math.min((pph / targetPPH) * 100, 150);
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [pointsEarned, elapsedMinutes, targetPPH, progressAnim]);

  useEffect(() => {
    if (!isTracking || elapsedMinutes < 5) return;

    const timeSinceLastCheck = elapsedSeconds - lastAlertCheckRef.current;
    if (timeSinceLastCheck < 60) return;
    lastAlertCheckRef.current = elapsedSeconds;

    const newAlerts: PPHAlert[] = [];

    if (currentPPH < targetPPH * 0.5 && pointsEarned > 0) {
      newAlerts.push({
        type: 'below_target',
        message: `PPH is ${Math.round(currentPPH)} - well below target of ${targetPPH}`,
        color: '#EF4444',
      });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else if (currentPPH < targetPPH * 0.8 && pointsEarned > 0) {
      newAlerts.push({
        type: 'pace_warning',
        message: `Pace slowing - currently at ${Math.round(currentPPH)} pts/hr`,
        color: '#F59E0B',
      });
    } else if (currentPPH >= targetPPH * 1.5) {
      newAlerts.push({
        type: 'above_target',
        message: `Excellent! ${Math.round(currentPPH)} pts/hr - 50%+ above target!`,
        color: '#10B981',
      });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }

    const milestones = [50, 100, 150, 200, 250, 500, 1000];
    milestones.forEach(milestone => {
      if (pointsEarned >= milestone && !milestoneReached.includes(milestone)) {
        setMilestoneReached(prev => [...prev, milestone]);
        newAlerts.push({
          type: 'milestone',
          message: `🎯 Milestone: ${milestone} points earned!`,
          color: '#8B5CF6',
        });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    });

    if (newAlerts.length > 0) {
      setAlerts(newAlerts);
      showAlertAnimation();
    }

    checkAndTriggerAlerts({
      currentPPH,
      targetPPH,
      sessionPoints: pointsEarned,
      sessionMinutes: Math.round(elapsedMinutes),
      isSessionActive: isTracking,
    });
  }, [isTracking, currentPPH, targetPPH, pointsEarned, elapsedSeconds, elapsedMinutes, milestoneReached, showAlertAnimation, checkAndTriggerAlerts]);

  const handleStart = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsTracking(true);
    startPulseAnimation();

    intervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    console.log('[LivePPHTracker] Session started');
  }, [startPulseAnimation]);

  const handlePause = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsTracking(false);
    stopPulseAnimation();

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    console.log('[LivePPHTracker] Session paused');
  }, [stopPulseAnimation]);

  const handleReset = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    
    if (elapsedMinutes >= 1 && pointsEarned > 0 && onSessionComplete) {
      onSessionComplete({
        durationMinutes: Math.round(elapsedMinutes),
        pointsEarned,
        pph: currentPPH,
      });
    }

    if (currentPPH > 0 && elapsedMinutes >= 5) {
      setPersonalBestPPH(currentPPH);
    }

    setIsTracking(false);
    setElapsedSeconds(0);
    setPointsEarned(0);
    setCurrentPPH(0);
    setAlerts([]);
    setMilestoneReached([]);
    stopPulseAnimation();
    progressAnim.setValue(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    console.log('[LivePPHTracker] Session reset');
  }, [elapsedMinutes, pointsEarned, currentPPH, onSessionComplete, stopPulseAnimation, progressAnim, setPersonalBestPPH]);

  const handleIncrementPoints = useCallback((amount: number) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setPointsEarned(prev => Math.max(0, prev + amount));
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatElapsedTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, []);

  const getPPHColor = useCallback((pph: number): string => {
    if (pph >= targetPPH * 1.2) return '#10B981';
    if (pph >= targetPPH) return '#3B82F6';
    if (pph >= targetPPH * 0.7) return '#F59E0B';
    return '#EF4444';
  }, [targetPPH]);

  const getPPHStatus = useCallback((pph: number): string => {
    if (pph >= targetPPH * 1.5) return 'Exceptional';
    if (pph >= targetPPH * 1.2) return 'Excellent';
    if (pph >= targetPPH) return 'On Target';
    if (pph >= targetPPH * 0.7) return 'Below Target';
    return 'Needs Improvement';
  }, [targetPPH]);

  const progressPercentage = useMemo(() => {
    return Math.min((currentPPH / targetPPH) * 100, 100);
  }, [currentPPH, targetPPH]);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Zap size={16} color="#F59E0B" />
          <Text style={styles.compactTitle}>Live PPH</Text>
          {isTracking && (
            <View style={styles.compactLiveBadge}>
              <View style={styles.compactLiveDot} />
              <Text style={styles.compactLiveText}>LIVE</Text>
            </View>
          )}
        </View>
        <View style={styles.compactContent}>
          <Text style={[styles.compactPPH, { color: getPPHColor(currentPPH) }]}>
            {currentPPH.toFixed(0)}
          </Text>
          <Text style={styles.compactUnit}>pts/hr</Text>
        </View>
        <View style={styles.compactTimer}>
          <Clock size={12} color="#6B7280" />
          <Text style={styles.compactTimerText}>{formatElapsedTime(elapsedSeconds)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.compactButton, isTracking && styles.compactButtonActive]}
          onPress={isTracking ? handlePause : handleStart}
          activeOpacity={0.7}
        >
          {isTracking ? (
            <Pause size={14} color="#FFFFFF" />
          ) : (
            <Play size={14} color="#10B981" />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F3E8FF', '#F3E8FF']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Zap size={18} color="#8B5CF6" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Live PPH Tracker</Text>
            <Text style={styles.headerSubtitle}>
              {isTracking ? 'Session in progress...' : 'Start tracking your session'}
            </Text>
          </View>
        </View>
        {isTracking && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </LinearGradient>

      <View style={styles.content}>
        {alerts.length > 0 && (
          <Animated.View
            style={[
              styles.alertContainer,
              {
                opacity: alertAnim,
                transform: [{
                  translateY: alertAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                }],
              },
            ]}
          >
            {alerts.map((alert, index) => (
              <View
                key={index}
                style={[styles.alertBadge, { backgroundColor: `${alert.color}20` }]}
              >
                <AlertTriangle size={14} color={alert.color} />
                <Text style={[styles.alertText, { color: alert.color }]}>
                  {alert.message}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        <Animated.View
          style={[
            styles.mainStatContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={styles.timerRow}>
            <Clock size={18} color="#6B7280" />
            <Text style={styles.timerText}>{formatElapsedTime(elapsedSeconds)}</Text>
          </View>

          <View style={styles.pphDisplay}>
            <Text style={[styles.pphValue, { color: getPPHColor(currentPPH) }]}>
              {currentPPH.toFixed(1)}
            </Text>
            <Text style={styles.pphUnit}>pts/hr</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: `${getPPHColor(currentPPH)}15` }]}>
            {currentPPH >= targetPPH ? (
              <TrendingUp size={14} color={getPPHColor(currentPPH)} />
            ) : (
              <TrendingDown size={14} color={getPPHColor(currentPPH)} />
            )}
            <Text style={[styles.statusText, { color: getPPHColor(currentPPH) }]}>
              {getPPHStatus(currentPPH)}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress to Target</Text>
            <Text style={styles.progressValue}>
              {progressPercentage.toFixed(0)}% of {targetPPH} pts/hr
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100, 150],
                    outputRange: ['0%', '100%', '100%'],
                  }),
                  backgroundColor: getPPHColor(currentPPH),
                },
              ]}
            />
            <View style={[styles.targetMarker, { left: '66.67%' }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressMinLabel}>0</Text>
            <Text style={styles.progressTargetLabel}>{targetPPH}</Text>
            <Text style={styles.progressMaxLabel}>{Math.round(targetPPH * 1.5)}</Text>
          </View>
        </View>

        <View style={styles.pointsSection}>
          <Text style={styles.pointsSectionTitle}>Points Earned</Text>
          <View style={styles.pointsRow}>
            <TouchableOpacity
              style={styles.pointsButton}
              onPress={() => handleIncrementPoints(-10)}
              activeOpacity={0.7}
            >
              <ChevronDown size={20} color="#EF4444" />
              <Text style={styles.pointsButtonText}>-10</Text>
            </TouchableOpacity>

            <View style={styles.pointsDisplay}>
              <Award size={20} color="#8B5CF6" />
              <Text style={styles.pointsValue}>{formatNumber(pointsEarned)}</Text>
              <Text style={styles.pointsLabel}>pts</Text>
            </View>

            <TouchableOpacity
              style={styles.pointsButton}
              onPress={() => handleIncrementPoints(10)}
              activeOpacity={0.7}
            >
              <ChevronUp size={20} color="#10B981" />
              <Text style={styles.pointsButtonText}>+10</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickPointsRow}>
            {[25, 50, 100, 250].map(amount => (
              <TouchableOpacity
                key={amount}
                style={styles.quickPointsButton}
                onPress={() => handleIncrementPoints(amount)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPointsText}>+{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Target size={14} color="#F59E0B" />
            <Text style={styles.statValue}>{targetPPH}</Text>
            <Text style={styles.statLabel}>Target</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <TrendingUp size={14} color="#8B5CF6" />
            <Text style={styles.statValue}>{historicalAvgPPH.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Your Avg</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Clock size={14} color="#3B82F6" />
            <Text style={styles.statValue}>{elapsedHours.toFixed(1)}h</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          {!isTracking && elapsedSeconds === 0 ? (
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStart}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.startButtonGradient}
              >
                <Play size={24} color={COLORS.white} />
                <Text style={styles.startButtonText}>Start Session</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  isTracking ? styles.pauseButton : styles.resumeButton,
                ]}
                onPress={isTracking ? handlePause : handleStart}
                activeOpacity={0.8}
              >
                {isTracking ? (
                  <>
                    <Pause size={20} color={COLORS.white} />
                    <Text style={styles.controlButtonText}>Pause</Text>
                  </>
                ) : (
                  <>
                    <Play size={20} color={COLORS.white} />
                    <Text style={styles.controlButtonText}>Resume</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
                activeOpacity={0.8}
              >
                <RotateCcw size={20} color="#6B7280" />
                <Text style={styles.resetButtonText}>End & Save</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#C7A7E0',
    ...SHADOW.md,
  },
  header: {
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3E8FF',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  liveText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    letterSpacing: 1,
  },
  content: {
    padding: SPACING.sm,
  },
  alertContainer: {
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  alertText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  mainStatContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  timerText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },
  pphDisplay: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  pphValue: {
    fontSize: 36,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: -1,
  },
  pphUnit: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  progressContainer: {
    marginBottom: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  progressValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  targetMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#8B5CF6',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressMinLabel: {
    fontSize: 9,
    color: '#64748B',
  },
  progressTargetLabel: {
    fontSize: 9,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  progressMaxLabel: {
    fontSize: 9,
    color: '#64748B',
  },
  pointsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pointsSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  pointsButton: {
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F3F4F6',
  },
  pointsButtonText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#6B7280',
    marginTop: 2,
  },
  pointsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#8B5CF6',
  },
  pointsLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#8B5CF6',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  quickPointsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  quickPointsButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: BORDER_RADIUS.round,
  },
  quickPointsText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#8B5CF6',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.xs,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  startButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  startButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  pauseButton: {
    backgroundColor: '#F59E0B',
  },
  resumeButton: {
    backgroundColor: '#10B981',
  },
  controlButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  resetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: SPACING.xs,
  },
  resetButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#6B7280',
  },
  compactContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  compactTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#92400E',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    flex: 1,
  },
  compactLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  compactLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  compactLiveText: {
    fontSize: 8,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#EF4444',
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  compactPPH: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  compactUnit: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#B45309',
  },
  compactTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  compactTimerText: {
    fontSize: 10,
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },
  compactButton: {
    position: 'absolute',
    right: SPACING.sm,
    top: '50%',
    transform: [{ translateY: -14 }],
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactButtonActive: {
    backgroundColor: '#F59E0B',
  },
});
