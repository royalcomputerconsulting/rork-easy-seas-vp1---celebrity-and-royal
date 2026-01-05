import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated,
  Platform,
} from 'react-native';
import { 
  Flame, 
  Trophy, 
  Target, 
  Star, 
  Award, 
  Zap, 
  Crown, 
  Sun, 
  Moon, 
  Ship, 
  Coins,
  Medal,
  ChevronRight,
  Clock,
  CheckCircle,
  Lock,
  Sparkles,
  Calendar,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { useGamification, Achievement, WeeklyGoal, PlayingStreak } from '@/state/GamificationProvider';
import { useHaptics } from '@/lib/useHaptics';
import { formatNumber } from '@/lib/format';

interface GamificationCardProps {
  showStreaks?: boolean;
  showAchievements?: boolean;
  showWeeklyGoals?: boolean;
  showLevel?: boolean;
  compact?: boolean;
  maxAchievements?: number;
}

const RARITY_COLORS = {
  common: { bg: '#6B7280', light: 'rgba(107, 114, 128, 0.15)' },
  rare: { bg: '#3B82F6', light: 'rgba(59, 130, 246, 0.15)' },
  epic: { bg: '#8B5CF6', light: 'rgba(139, 92, 246, 0.15)' },
  legendary: { bg: '#F59E0B', light: 'rgba(245, 158, 11, 0.15)' },
};

const getAchievementIcon = (iconType: Achievement['icon'], size: number, color: string) => {
  const icons = {
    trophy: <Trophy size={size} color={color} />,
    star: <Star size={size} color={color} fill={color} />,
    crown: <Crown size={size} color={color} />,
    award: <Award size={size} color={color} />,
    zap: <Zap size={size} color={color} fill={color} />,
    target: <Target size={size} color={color} />,
    flame: <Flame size={size} color={color} fill={color} />,
    sun: <Sun size={size} color={color} />,
    moon: <Moon size={size} color={color} />,
    ship: <Ship size={size} color={color} />,
    coins: <Coins size={size} color={color} />,
    medal: <Medal size={size} color={color} />,
  };
  return icons[iconType] || <Trophy size={size} color={color} />;
};

function StreakDisplay({ streak }: { streak: PlayingStreak }) {
  const flameScale = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (streak.currentDailyStreak > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(flameScale, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(flameScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [streak.currentDailyStreak, flameScale]);

  const isOnFire = streak.currentDailyStreak >= 3;
  const isStreakAlive = streak.currentDailyStreak > 0;

  return (
    <View style={styles.streakContainer}>
      <View style={styles.streakCard}>
        <View style={styles.streakCardHeader}>
          <View style={styles.streakHeaderContent}>
            <View style={[styles.streakHeaderIcon, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
              <Flame size={18} color="#F97316" />
            </View>
            <View>
              <Text style={styles.streakCardTitle}>Daily Streak</Text>
              <Text style={styles.streakCardSubtitle}>Track your playing consistency</Text>
            </View>
          </View>
          {isOnFire && (
            <View style={styles.onFireBadge}>
              <Sparkles size={12} color="#F97316" />
              <Text style={styles.onFireText}>ON FIRE!</Text>
            </View>
          )}
        </View>

        <View style={styles.streakContent}>
          <View style={styles.streakRow}>
            <View style={[styles.streakIconContainer, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
              <Animated.View style={{ transform: [{ scale: flameScale }] }}>
                <Flame 
                  size={16} 
                  color={isStreakAlive ? '#F97316' : '#9CA3AF'} 
                  fill={isStreakAlive ? '#F97316' : 'transparent'}
                />
              </Animated.View>
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakLabel}>Current Streak</Text>
              <Text style={styles.streakSubtext}>Keep the fire burning</Text>
            </View>
            <Text style={[styles.streakValue, { color: isStreakAlive ? '#F97316' : COLORS.navyDeep }]}>
              {streak.currentDailyStreak} {streak.currentDailyStreak === 1 ? 'day' : 'days'}
            </Text>
          </View>
          
          <View style={styles.streakDivider} />
          
          <View style={styles.streakRow}>
            <View style={[styles.streakIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Trophy size={16} color="#8B5CF6" />
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakLabel}>Best Streak</Text>
              <Text style={styles.streakSubtext}>Your longest streak</Text>
            </View>
            <Text style={styles.streakValue}>{streak.longestDailyStreak} days</Text>
          </View>
          
          <View style={styles.streakDivider} />
          
          <View style={styles.streakRow}>
            <View style={[styles.streakIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Calendar size={16} color="#3B82F6" />
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakLabel}>Weekly Streak</Text>
              <Text style={styles.streakSubtext}>Consecutive weeks</Text>
            </View>
            <Text style={styles.streakValue}>{streak.currentWeeklyStreak} weeks</Text>
          </View>
          
          <View style={styles.streakDivider} />
          
          <View style={styles.streakStatsRow}>
            <View style={styles.streakInfo}>
              <Text style={[styles.streakLabel, styles.streakTotalLabel]}>Total Days Played</Text>
              <Text style={styles.streakSubtext}>Overall activity</Text>
            </View>
            <Text style={[styles.streakTotalValue, { color: COLORS.navyDeep }]}>
              {streak.totalDaysPlayed} days
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function WeeklyGoalItem({ goal }: { goal: WeeklyGoal }) {
  const progress = Math.min((goal.current / goal.target) * 100, 100);
  const isCompleted = goal.completed;
  
  const getGoalIcon = () => {
    switch (goal.type) {
      case 'points':
        return <Target size={18} color={isCompleted ? COLORS.success : COLORS.navyDeep} />;
      case 'sessions':
        return <Zap size={18} color={isCompleted ? COLORS.success : COLORS.navyDeep} />;
      case 'time':
        return <Clock size={18} color={isCompleted ? COLORS.success : COLORS.navyDeep} />;
      case 'winnings':
        return <Coins size={18} color={isCompleted ? COLORS.success : COLORS.navyDeep} />;
      default:
        return <Target size={18} color={COLORS.navyDeep} />;
    }
  };

  const getGoalLabel = () => {
    switch (goal.type) {
      case 'points':
        return `Earn ${formatNumber(goal.target)} points`;
      case 'sessions':
        return `Complete ${goal.target} sessions`;
      case 'time':
        return `Play ${Math.floor(goal.target / 60)}h ${goal.target % 60}m`;
      case 'winnings':
        return `Win $${formatNumber(goal.target)}`;
      default:
        return 'Complete goal';
    }
  };

  const getCurrentDisplay = () => {
    switch (goal.type) {
      case 'points':
        return formatNumber(goal.current);
      case 'sessions':
        return goal.current.toString();
      case 'time':
        const hours = Math.floor(goal.current / 60);
        const mins = goal.current % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      case 'winnings':
        return `$${formatNumber(goal.current)}`;
      default:
        return goal.current.toString();
    }
  };

  return (
    <View style={[styles.goalItem, isCompleted && styles.goalItemCompleted]}>
      <View style={styles.goalIconContainer}>
        {isCompleted ? (
          <CheckCircle size={18} color={COLORS.success} fill={COLORS.success} />
        ) : (
          getGoalIcon()
        )}
      </View>
      <View style={styles.goalContent}>
        <Text style={[styles.goalLabel, isCompleted && styles.goalLabelCompleted]}>
          {getGoalLabel()}
        </Text>
        <View style={styles.goalProgressContainer}>
          <View style={styles.goalProgressBar}>
            <View 
              style={[
                styles.goalProgressFill, 
                { 
                  width: `${progress}%`,
                  backgroundColor: isCompleted ? COLORS.success : COLORS.navyDeep,
                }
              ]} 
            />
          </View>
          <Text style={styles.goalProgressText}>
            {getCurrentDisplay()} / {goal.type === 'time' 
              ? `${Math.floor(goal.target / 60)}h` 
              : goal.type === 'winnings' 
                ? `$${formatNumber(goal.target)}`
                : formatNumber(goal.target)}
          </Text>
        </View>
      </View>
      {isCompleted && goal.reward && (
        <View style={styles.goalRewardBadge}>
          <Text style={styles.goalRewardText}>{goal.reward}</Text>
        </View>
      )}
    </View>
  );
}

function AchievementBadge({ 
  achievement, 
  onPress 
}: { 
  achievement: Achievement; 
  onPress?: () => void;
}) {
  const haptics = useHaptics();
  const isUnlocked = !!achievement.unlockedAt;
  const rarityColors = RARITY_COLORS[achievement.rarity];
  
  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      haptics.buttonPress();
    }
    onPress?.();
  }, [onPress, haptics]);

  return (
    <TouchableOpacity
      style={[
        styles.achievementBadge,
        { backgroundColor: isUnlocked ? rarityColors.light : CLEAN_THEME.background.tertiary },
        !isUnlocked && styles.achievementBadgeLocked,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.achievementIconContainer,
        { backgroundColor: isUnlocked ? rarityColors.bg : '#9CA3AF' },
      ]}>
        {isUnlocked ? (
          getAchievementIcon(achievement.icon, 16, '#FFFFFF')
        ) : (
          <Lock size={12} color="#FFFFFF" />
        )}
      </View>
      <Text 
        style={[
          styles.achievementName, 
          !isUnlocked && styles.achievementNameLocked
        ]}
        numberOfLines={1}
      >
        {achievement.name}
      </Text>
      <Text style={[styles.achievementRarity, { color: rarityColors.bg }]}>
        {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)}
      </Text>
    </TouchableOpacity>
  );
}

function LevelDisplay({ level, xp, nextLevelXP }: { level: number; xp: number; nextLevelXP: number }) {
  const progress = nextLevelXP > 0 ? (xp / nextLevelXP) * 100 : 0;
  const marbleConfig = MARBLE_TEXTURES.white;
  
  return (
    <LinearGradient
      colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
      locations={marbleConfig.gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.levelContainer}
    >
      <View style={styles.levelBadge}>
        <Text style={styles.levelNumber}>{level}</Text>
      </View>
      <View style={styles.levelInfo}>
        <Text style={styles.levelLabel}>Player Level</Text>
        <View style={styles.xpProgressContainer}>
          <View style={styles.xpProgressBar}>
            <LinearGradient
              colors={['#8B5CF6', '#A78BFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.xpProgressFill, { width: `${Math.min(progress, 100)}%` }]}
            />
          </View>
          <Text style={styles.xpText}>{formatNumber(xp)} / {formatNumber(nextLevelXP)} XP</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

export function GamificationCard({
  showStreaks = true,
  showAchievements = true,
  showWeeklyGoals = true,
  showLevel = true,
  compact = false,
  maxAchievements = 6,
}: GamificationCardProps) {
  const { 
    achievements, 
    streak, 
    weeklyGoals, 
    stats,
    getUnlockedAchievements,
    getLockedAchievements,
  } = useGamification();
  
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const haptics = useHaptics();

  const unlockedAchievements = useMemo(() => getUnlockedAchievements(), [getUnlockedAchievements]);
  const lockedAchievements = useMemo(() => getLockedAchievements(), [getLockedAchievements]);
  
  const displayAchievements = useMemo(() => {
    const all = [...unlockedAchievements, ...lockedAchievements];
    return showAllAchievements ? all : all.slice(0, maxAchievements);
  }, [unlockedAchievements, lockedAchievements, showAllAchievements, maxAchievements]);

  const completedGoals = useMemo(() => {
    return weeklyGoals.filter(g => g.completed);
  }, [weeklyGoals]);

  const handleToggleAchievements = useCallback(() => {
    if (Platform.OS !== 'web') {
      haptics.buttonPress();
    }
    setShowAllAchievements(prev => !prev);
  }, [haptics]);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactRow}>
          <View style={styles.compactStreakItem}>
            <Flame size={20} color="#F97316" fill="#F97316" />
            <Text style={styles.compactStreakValue}>{streak.currentDailyStreak}</Text>
            <Text style={styles.compactStreakLabel}>Day Streak</Text>
          </View>
          <View style={styles.compactDivider} />
          <View style={styles.compactStreakItem}>
            <Trophy size={20} color="#F59E0B" />
            <Text style={styles.compactStreakValue}>{unlockedAchievements.length}</Text>
            <Text style={styles.compactStreakLabel}>Achievements</Text>
          </View>
          <View style={styles.compactDivider} />
          <View style={styles.compactStreakItem}>
            <Star size={20} color="#8B5CF6" fill="#8B5CF6" />
            <Text style={styles.compactStreakValue}>Lv.{stats.currentLevel}</Text>
            <Text style={styles.compactStreakLabel}>Player Level</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showLevel && (
        <LevelDisplay 
          level={stats.currentLevel} 
          xp={stats.experiencePoints} 
          nextLevelXP={stats.nextLevelXP} 
        />
      )}

      {showStreaks && (
        <StreakDisplay streak={streak} />
      )}

      {showWeeklyGoals && weeklyGoals.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target size={16} color={COLORS.navyDeep} />
            <Text style={styles.sectionTitle}>Weekly Goals</Text>
            <View style={styles.goalCountBadge}>
              <Text style={styles.goalCountText}>
                {completedGoals.length}/{weeklyGoals.length}
              </Text>
            </View>
          </View>
          <View style={styles.goalsContainer}>
            {weeklyGoals.map(goal => (
              <WeeklyGoalItem key={goal.id} goal={goal} />
            ))}
          </View>
        </View>
      )}

      {showAchievements && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trophy size={16} color={COLORS.navyDeep} />
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.achievementCountBadge}>
              <Text style={styles.achievementCountText}>
                {unlockedAchievements.length}/{achievements.length}
              </Text>
            </View>
          </View>
          
          <View style={styles.achievementsGrid}>
            {displayAchievements.map(achievement => (
              <AchievementBadge 
                key={achievement.id} 
                achievement={achievement}
              />
            ))}
          </View>
          
          {achievements.length > maxAchievements && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={handleToggleAchievements}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>
                {showAllAchievements ? 'Show Less' : `View All ${achievements.length} Achievements`}
              </Text>
              <ChevronRight 
                size={14} 
                color={COLORS.navyDeep} 
                style={{ transform: [{ rotate: showAllAchievements ? '90deg' : '0deg' }] }}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  compactContainer: {
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  compactStreakItem: {
    alignItems: 'center',
    gap: 4,
  },
  compactStreakValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  compactStreakLabel: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
  },
  compactDivider: {
    width: 1,
    height: 40,
    backgroundColor: CLEAN_THEME.border.light,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  levelNumber: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  levelInfo: {
    flex: 1,
  },
  levelLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  xpProgressContainer: {
    gap: 4,
  },
  xpProgressBar: {
    height: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  xpText: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
  },
  streakContainer: {
    marginBottom: 0,
  },
  streakCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F97316',
  },
  streakCardHeader: {
    backgroundColor: '#FFF7ED',
    padding: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: '#F97316',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  streakHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakCardTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
  },
  streakCardSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#000000',
    opacity: 0.6,
  },
  streakContent: {
    padding: SPACING.md,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  streakIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  streakInfo: {
    flex: 1,
  },
  streakLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  streakSubtext: {
    fontSize: 10,
    color: '#000000',
    opacity: 0.5,
    marginTop: 2,
  },
  streakValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  streakDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: SPACING.xs,
  },
  onFireBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#F97316',
  },
  onFireText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#F97316',
    letterSpacing: 0.5,
  },
  streakStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    marginHorizontal: -SPACING.md,
    marginBottom: -SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 2,
    borderTopColor: '#F97316',
  },
  streakTotalLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  streakTotalValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  section: {
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.primary,
  },
  goalCountBadge: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  goalCountText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  goalsContainer: {
    gap: SPACING.sm,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  goalItemCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  goalIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CLEAN_THEME.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  goalContent: {
    flex: 1,
  },
  goalLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  goalLabelCompleted: {
    color: COLORS.success,
  },
  goalProgressContainer: {
    gap: 2,
  },
  goalProgressBar: {
    height: 4,
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  goalProgressText: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
  },
  goalRewardBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  goalRewardText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.success,
  },
  achievementCountBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  achievementCountText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  achievementsScroll: {
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  achievementBadge: {
    width: '18%',
    aspectRatio: 1,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementBadgeLocked: {
    opacity: 0.6,
  },
  achievementIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  achievementName: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    textAlign: 'center',
    marginBottom: 1,
  },
  achievementNameLocked: {
    color: CLEAN_THEME.text.secondary,
  },
  achievementRarity: {
    fontSize: 7,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    textTransform: 'uppercase' as const,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  viewAllText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
});
