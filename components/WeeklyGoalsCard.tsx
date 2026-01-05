import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native';
import {
  Target,
  Clock,
  Zap,
  Award,
  CheckCircle,
  Check,
  Calendar,
  TrendingUp,
  Flame,
  Coins,
  ChevronRight,
  Star,
  Trophy,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useGamification, WeeklyGoal } from '@/state/GamificationProvider';
import { formatNumber } from '@/lib/format';

interface WeeklyGoalsCardProps {
  onGoalComplete?: (goal: WeeklyGoal) => void;
  compact?: boolean;
}

const GOAL_CONFIG: Record<WeeklyGoal['type'], {
  icon: typeof Target;
  label: string;
  unit: string;
  color: string;
  lightColor: string;
  gradientColors: [string, string];
  formatValue: (value: number) => string;
}> = {
  points: {
    icon: Target,
    label: 'Points Goal',
    unit: 'pts',
    color: '#8B5CF6',
    lightColor: 'rgba(139, 92, 246, 0.15)',
    gradientColors: ['#8B5CF6', '#7C3AED'],
    formatValue: (v) => formatNumber(v),
  },
  sessions: {
    icon: Zap,
    label: 'Sessions Goal',
    unit: 'sessions',
    color: '#3B82F6',
    lightColor: 'rgba(59, 130, 246, 0.15)',
    gradientColors: ['#3B82F6', '#2563EB'],
    formatValue: (v) => v.toString(),
  },
  time: {
    icon: Clock,
    label: 'Play Time Goal',
    unit: 'hours',
    color: '#10B981',
    lightColor: 'rgba(16, 185, 129, 0.15)',
    gradientColors: ['#10B981', '#059669'],
    formatValue: (v) => {
      const hours = Math.floor(v / 60);
      const mins = v % 60;
      if (hours === 0) return `${mins}m`;
      if (mins === 0) return `${hours}h`;
      return `${hours}h ${mins}m`;
    },
  },
  winnings: {
    icon: Coins,
    label: 'Winnings Goal',
    unit: '$',
    color: '#F59E0B',
    lightColor: 'rgba(245, 158, 11, 0.15)',
    gradientColors: ['#F59E0B', '#D97706'],
    formatValue: (v) => `$${formatNumber(v)}`,
  },
};

function CircularProgress({
  progress,
  size = 80,
  strokeWidth = 8,
  color,
  backgroundColor = 'rgba(0,0,0,0.08)',
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  backgroundColor?: string;
  children?: React.ReactNode;
}) {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: Math.min(progress, 100),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedProgress]);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: backgroundColor,
          }}
        />
      </View>
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            borderLeftColor: 'transparent',
            borderBottomColor: 'transparent',
            transform: [{ rotate: `${(progress / 100) * 360}deg` }],
            opacity: progress > 0 ? 1 : 0,
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function GoalProgressRing({
  goal,
  isEditing,
  onEdit,
  onSave,
  editValue,
  onEditChange,
}: {
  goal: WeeklyGoal;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  editValue: string;
  onEditChange: (value: string) => void;
}) {
  const config = GOAL_CONFIG[goal.type];
  const progress = Math.min((goal.current / goal.target) * 100, 100);
  const isCompleted = goal.completed;
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkScaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isCompleted) {
      Animated.parallel([
        Animated.spring(checkScaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
    } else {
      checkScaleAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [isCompleted, checkScaleAnim, pulseAnim]);

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onEdit();
  }, [onEdit]);

  const IconComponent = config.icon;

  return (
    <Animated.View style={[styles.goalRingContainer, { transform: [{ scale: pulseAnim }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <CircularProgress
          progress={progress}
          size={90}
          strokeWidth={8}
          color={isCompleted ? '#10B981' : config.color}
          backgroundColor={config.lightColor}
        >
          {isCompleted ? (
            <Animated.View style={{ transform: [{ scale: checkScaleAnim }] }}>
              <CheckCircle size={32} color="#10B981" fill="#10B981" />
            </Animated.View>
          ) : (
            <View style={styles.goalRingContent}>
              <IconComponent size={18} color={config.color} />
              <Text style={[styles.goalRingProgress, { color: config.color }]}>
                {Math.round(progress)}%
              </Text>
            </View>
          )}
        </CircularProgress>
      </TouchableOpacity>
      
      <Text style={styles.goalRingLabel}>{config.label}</Text>
      
      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={[styles.editInput, { borderColor: config.color }]}
            value={editValue}
            onChangeText={onEditChange}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
          />
          <TouchableOpacity onPress={onSave} style={styles.editButton}>
            <Check size={14} color="#10B981" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.goalValueContainer}>
          <Text style={styles.goalCurrentValue}>
            {config.formatValue(goal.current)}
          </Text>
          <Text style={styles.goalDivider}>/</Text>
          <Text style={styles.goalTargetValue}>
            {config.formatValue(goal.target)}
          </Text>
        </View>
      )}
      
      {isCompleted && goal.reward && (
        <View style={[styles.rewardBadge, { backgroundColor: config.lightColor }]}>
          <Star size={10} color={config.color} fill={config.color} />
          <Text style={[styles.rewardText, { color: config.color }]}>{goal.reward}</Text>
        </View>
      )}
    </Animated.View>
  );
}

function WeekProgressBar({ weeklyGoals }: { weeklyGoals: WeeklyGoal[] }) {
  const completedCount = weeklyGoals.filter(g => g.completed).length;
  const totalCount = weeklyGoals.length;
  const overallProgress = totalCount > 0 
    ? weeklyGoals.reduce((sum, g) => sum + Math.min((g.current / g.target) * 100, 100), 0) / totalCount 
    : 0;

  const weekStart = weeklyGoals[0]?.weekStart || '';
  const weekEnd = weeklyGoals[0]?.weekEnd || '';

  const formatWeekDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.weekProgressContainer}>
      <View style={styles.weekProgressHeader}>
        <View style={styles.weekDateContainer}>
          <Calendar size={12} color={COLORS.navyDeep} />
          <Text style={styles.weekDateText}>
            {formatWeekDate(weekStart)} - {formatWeekDate(weekEnd)}
          </Text>
        </View>
        <View style={styles.completionBadge}>
          <Trophy size={12} color="#F59E0B" />
          <Text style={styles.completionText}>
            {completedCount}/{totalCount} Complete
          </Text>
        </View>
      </View>
      
      <View style={styles.overallProgressTrack}>
        <Animated.View
          style={[
            styles.overallProgressFill,
            { width: `${overallProgress}%` },
          ]}
        />
      </View>
      
      <View style={styles.progressLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>{completedCount} Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>{totalCount - completedCount} In Progress</Text>
        </View>
      </View>
    </View>
  );
}

export function WeeklyGoalsCard({ onGoalComplete, compact = false }: WeeklyGoalsCardProps) {
  const { weeklyGoals } = useGamification();
  const [editingGoal, setEditingGoal] = useState<WeeklyGoal['type'] | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleEditGoal = useCallback((goalType: WeeklyGoal['type']) => {
    const goal = weeklyGoals.find(g => g.type === goalType);
    if (goal) {
      setEditValues(prev => ({ ...prev, [goalType]: goal.target.toString() }));
      setEditingGoal(goalType);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [weeklyGoals]);

  const handleSaveGoal = useCallback((goalType: WeeklyGoal['type']) => {
    const newTarget = parseInt(editValues[goalType], 10);
    if (!isNaN(newTarget) && newTarget > 0) {
      console.log('[WeeklyGoalsCard] Would update goal target:', goalType, newTarget);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    setEditingGoal(null);
  }, [editValues]);

  const handleEditChange = useCallback((goalType: WeeklyGoal['type'], value: string) => {
    setEditValues(prev => ({ ...prev, [goalType]: value }));
  }, []);

  const completedGoalsCount = useMemo(() => {
    return weeklyGoals.filter(g => g.completed).length;
  }, [weeklyGoals]);

  useEffect(() => {
    const newlyCompleted = weeklyGoals.find(g => g.completed);
    if (newlyCompleted && onGoalComplete) {
      onGoalComplete(newlyCompleted);
    }
  }, [completedGoalsCount, weeklyGoals, onGoalComplete]);

  if (compact) {
    const completedCount = weeklyGoals.filter(g => g.completed).length;
    const totalProgress = weeklyGoals.reduce((sum, g) => 
      sum + Math.min((g.current / g.target) * 100, 100), 0) / weeklyGoals.length;

    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <View style={styles.compactIconContainer}>
            <Target size={16} color="#3B82F6" />
          </View>
          <Text style={styles.compactTitle}>Weekly Goals</Text>
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactValue}>{completedCount}/{weeklyGoals.length}</Text>
          <Text style={styles.compactSubtext}>
            {totalProgress.toFixed(0)}% overall
          </Text>
        </View>
        <View style={styles.compactProgressBar}>
          <View style={[styles.compactProgressFill, { width: `${totalProgress}%` }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#3B82F6', '#2563EB']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Target size={20} color={COLORS.white} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Weekly Goals</Text>
            <Text style={styles.headerSubtitle}>Track your weekly targets</Text>
          </View>
        </View>
        <View style={styles.headerBadge}>
          <Flame size={14} color="#F59E0B" />
          <Text style={styles.headerBadgeText}>
            {completedGoalsCount}/{weeklyGoals.length}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <WeekProgressBar weeklyGoals={weeklyGoals} />

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.goalsScrollContent}
        >
          {weeklyGoals.map((goal) => (
            <GoalProgressRing
              key={goal.id}
              goal={goal}
              isEditing={editingGoal === goal.type}
              onEdit={() => handleEditGoal(goal.type)}
              onSave={() => handleSaveGoal(goal.type)}
              editValue={editValues[goal.type] || ''}
              onEditChange={(value) => handleEditChange(goal.type, value)}
            />
          ))}
        </ScrollView>

        <View style={styles.goalsListContainer}>
          {weeklyGoals.map((goal) => {
            const config = GOAL_CONFIG[goal.type];
            const progress = Math.min((goal.current / goal.target) * 100, 100);
            const IconComponent = config.icon;
            
            return (
              <View key={goal.id} style={[
                styles.goalListItem,
                goal.completed && styles.goalListItemCompleted,
              ]}>
                <View style={[styles.goalListIcon, { backgroundColor: config.lightColor }]}>
                  {goal.completed ? (
                    <CheckCircle size={16} color="#10B981" fill="#10B981" />
                  ) : (
                    <IconComponent size={16} color={config.color} />
                  )}
                </View>
                <View style={styles.goalListContent}>
                  <View style={styles.goalListHeader}>
                    <Text style={[
                      styles.goalListLabel,
                      goal.completed && styles.goalListLabelCompleted,
                    ]}>
                      {config.label}
                    </Text>
                    <Text style={[
                      styles.goalListProgress,
                      { color: goal.completed ? '#10B981' : config.color },
                    ]}>
                      {config.formatValue(goal.current)} / {config.formatValue(goal.target)}
                    </Text>
                  </View>
                  <View style={styles.goalListProgressBar}>
                    <View 
                      style={[
                        styles.goalListProgressFill,
                        { 
                          width: `${progress}%`,
                          backgroundColor: goal.completed ? '#10B981' : config.color,
                        },
                      ]} 
                    />
                  </View>
                </View>
                <ChevronRight size={14} color="#D1D5DB" />
              </View>
            );
          })}
        </View>

        {completedGoalsCount === weeklyGoals.length && weeklyGoals.length > 0 && (
          <View style={styles.allCompleteCard}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.allCompleteGradient}
            >
              <View style={styles.allCompleteContent}>
                <View style={styles.allCompleteIcon}>
                  <Trophy size={24} color="#FFFFFF" />
                </View>
                <View style={styles.allCompleteText}>
                  <Text style={styles.allCompleteTitle}>All Goals Complete!</Text>
                  <Text style={styles.allCompleteSubtitle}>
                    Amazing work this week! Keep the momentum going.
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        <View style={styles.tipsContainer}>
          <View style={styles.tipRow}>
            <View style={styles.tipIcon}>
              <TrendingUp size={12} color="#3B82F6" />
            </View>
            <Text style={styles.tipText}>
              Tap on a goal circle to edit its target
            </Text>
          </View>
          <View style={styles.tipRow}>
            <View style={styles.tipIcon}>
              <Award size={12} color="#F59E0B" />
            </View>
            <Text style={styles.tipText}>
              Complete all goals to earn bonus rewards
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EFF6FF',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3B82F6',
    ...SHADOW.md,
  },
  header: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  headerBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  content: {
    padding: SPACING.md,
  },
  weekProgressContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  weekProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  weekDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  weekDateText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  completionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  completionText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#B45309',
  },
  overallProgressTrack: {
    height: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  overallProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#6B7280',
  },
  goalsScrollContent: {
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  goalRingContainer: {
    alignItems: 'center',
    width: 110,
    marginRight: SPACING.sm,
  },
  goalRingContent: {
    alignItems: 'center',
    gap: 2,
  },
  goalRingProgress: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  goalRingLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  goalValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  goalCurrentValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  goalDivider: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#9CA3AF',
    marginHorizontal: 2,
  },
  goalTargetValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  editInput: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 50,
    textAlign: 'center',
  },
  editButton: {
    padding: 4,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: 4,
  },
  rewardText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  goalsListContainer: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  goalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  goalListItemCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  goalListIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  goalListContent: {
    flex: 1,
  },
  goalListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  goalListLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
  goalListLabelCompleted: {
    color: '#10B981',
  },
  goalListProgress: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  goalListProgressBar: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  goalListProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  allCompleteCard: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  allCompleteGradient: {
    padding: SPACING.md,
  },
  allCompleteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  allCompleteIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allCompleteText: {
    flex: 1,
  },
  allCompleteTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    marginBottom: 2,
  },
  allCompleteSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  tipsContainer: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  tipIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#1E40AF',
  },
  compactContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  compactIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#1E40AF',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  compactValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#3B82F6',
  },
  compactSubtext: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
  },
  compactProgressBar: {
    height: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
});
