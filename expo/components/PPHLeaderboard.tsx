import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import {
  Trophy,
  Medal,
  Award,
  Clock,
  Calendar,
  Zap,
  Crown,
  TrendingUp,
  Flame,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { formatNumber } from '@/lib/format';
import type { CasinoSession, MachineType } from '@/state/CasinoSessionProvider';

interface PPHLeaderboardProps {
  sessions: CasinoSession[];
  maxEntries?: number;
  onSessionPress?: (session: CasinoSession) => void;
}

const MACHINE_TYPE_LABELS: Record<MachineType, string> = {
  'penny-slots': 'Penny',
  'nickel-slots': 'Nickel',
  'quarter-slots': 'Quarter',
  'dollar-slots': 'Dollar',
  'high-limit-slots': 'High Limit',
  'video-poker': 'VP',
  'blackjack': 'BJ',
  'roulette': 'Roulette',
  'craps': 'Craps',
  'baccarat': 'Bacc',
  'poker': 'Poker',
  'other': 'Other',
};

interface RankedSession extends CasinoSession {
  pph: number;
  rank: number;
}

function AnimatedRankBadge({
  rank,
  delay,
}: {
  rank: number;
  delay: number;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: delay,
      tension: 150,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [delay, scaleAnim]);

  const getRankConfig = () => {
    switch (rank) {
      case 1:
        return { 
          colors: ['#E6B63D', '#D97706'], 
          icon: <Crown size={16} color="#FFFFFF" />,
          label: '1st' 
        };
      case 2:
        return { 
          colors: ['#8E8A89', '#676A70'], 
          icon: <Medal size={16} color="#FFFFFF" />,
          label: '2nd' 
        };
      case 3:
        return { 
          colors: ['#B45309', '#92400E'], 
          icon: <Award size={16} color="#FFFFFF" />,
          label: '3rd' 
        };
      default:
        return { 
          colors: ['#D5D5D0', '#D5D5D0'], 
          icon: <Text style={styles.rankNumber}>{rank}</Text>,
          label: `${rank}th` 
        };
    }
  };

  const config = getRankConfig();

  return (
    <Animated.View
      style={[
        styles.rankBadgeContainer,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: config.colors[0] }]}>
        {config.icon}
      </View>
    </Animated.View>
  );
}

function LeaderboardRow({
  session,
  rank,
  delay,
  isTop3,
  onPress,
}: {
  session: RankedSession;
  rank: number;
  delay: number;
  isTop3: boolean;
  onPress?: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: delay,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        delay: delay,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, slideAnim, opacityAnim]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const formatDuration = (minutes: number): string => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onPress?.();
  }, [onPress]);

  return (
    <Animated.View
      style={[
        styles.rowContainer,
        {
          transform: [{ translateX: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.rowTouchable}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        <AnimatedRankBadge rank={rank} delay={delay + 100} />

        <View style={styles.sessionInfo}>
          <View style={styles.sessionTopRow}>
            <View style={styles.pphContainer}>
              <Zap size={12} color="#8B5CF6" />
              <Text style={styles.pphValue}>
                {session.pph.toFixed(1)}
              </Text>
              <Text style={styles.pphUnit}>pts/hr</Text>
            </View>
            {rank === 1 && (
              <View style={styles.fireBadge}>
                <Flame size={10} color="#A52B34" fill="#A52B34" />
                <Text style={styles.fireText}>TOP</Text>
              </View>
            )}
          </View>

          <View style={styles.sessionMetaRow}>
            <View style={styles.metaItem}>
              <Calendar size={10} color="#676A70" />
              <Text style={styles.metaText}>{formatDate(session.date)}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Clock size={10} color="#676A70" />
              <Text style={styles.metaText}>{formatDuration(session.durationMinutes)}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Award size={10} color="#8B5CF6" />
              <Text style={styles.metaText}>{formatNumber(session.pointsEarned || 0)} pts</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function PPHLeaderboard({
  sessions,
  maxEntries = 3,
  onSessionPress,
}: PPHLeaderboardProps) {
  const rankedSessions = useMemo((): RankedSession[] => {
    return sessions
      .filter(s => (s.pointsEarned || 0) > 0 && s.durationMinutes > 0)
      .map(s => ({
        ...s,
        pph: ((s.pointsEarned || 0) / s.durationMinutes) * 60,
        rank: 0,
      }))
      .sort((a, b) => b.pph - a.pph)
      .slice(0, maxEntries)
      .map((s, index) => ({ ...s, rank: index + 1 }));
  }, [sessions, maxEntries]);

  const stats = useMemo(() => {
    if (rankedSessions.length === 0) {
      return { avg: 0, best: 0, total: 0 };
    }

    const pphValues = rankedSessions.map(s => s.pph);
    return {
      avg: pphValues.reduce((sum, v) => sum + v, 0) / pphValues.length,
      best: Math.max(...pphValues),
      total: rankedSessions.length,
    };
  }, [rankedSessions]);

  if (rankedSessions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Trophy size={18} color={COLORS.navyDeep} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>PPH Leaderboard</Text>
              <Text style={styles.headerSubtitle}>Top 3 sessions</Text>
            </View>
          </View>
        </View>

        <View style={styles.emptyContent}>
          <Trophy size={40} color="#D5D5D0" />
          <Text style={styles.emptyText}>No sessions yet</Text>
          <Text style={styles.emptySubtext}>Start tracking sessions to build your leaderboard</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Trophy size={18} color={COLORS.navyDeep} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>PPH Leaderboard</Text>
            <Text style={styles.headerSubtitle}>Top 3 sessions</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Best PPH</Text>
            <Text style={styles.statValue}>{stats.best.toFixed(0)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Top Avg</Text>
            <Text style={styles.statValue}>{stats.avg.toFixed(0)}</Text>
          </View>
        </View>

        <View style={styles.leaderboardList}>
          {rankedSessions.map((session, index) => (
            <LeaderboardRow
              key={session.id}
              session={session}
              rank={session.rank}
              delay={index * 80}
              isTop3={index < 3}
              onPress={onSessionPress ? () => onSessionPress(session) : undefined}
            />
          ))}
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
    borderColor: COLORS.navyDeep,
    ...SHADOW.md,
  },
  header: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F4',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navyDeep,
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
    backgroundColor: 'rgba(0, 31, 63, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
  },
  totalBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 31, 63, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  content: {
    padding: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F4',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#D5D5D0',
    marginHorizontal: SPACING.sm,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1E293B',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginBottom: 4,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  leaderboardList: {
    gap: SPACING.sm,
  },
  rowContainer: {
    backgroundColor: '#F5F5F4',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    overflow: 'hidden',
  },
  rowContainerTop3: {
    borderColor: '#D5D5D0',
    backgroundColor: '#F5F5F4',
  },
  rowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  rankBadgeContainer: {},
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#676A70',
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pphContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pphValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  pphValueTop3: {
    color: '#1E293B',
  },
  pphUnit: {
    fontSize: 10,
    color: '#676A70',
    marginTop: 2,
  },
  fireBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  fireText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#A52B34',
    letterSpacing: 0.5,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 10,
    color: '#676A70',
  },
  metaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#D5D5D0',
  },
  machineTypeBadge: {
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  machineTypeText: {
    fontSize: 9,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  rankIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContent: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#676A70',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#8E8A89',
    textAlign: 'center',
  },
});
