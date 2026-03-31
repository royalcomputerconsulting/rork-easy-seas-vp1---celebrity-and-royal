import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { 
  Ship, 
  Bookmark, 
  Tag, 
  DollarSign,
  TrendingUp,
  Calendar,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';

interface QuickStatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  onPress?: () => void;
}

interface QuickStatsProps {
  stats: QuickStatItem[];
  columns?: 2 | 3 | 4;
}

export function QuickStats({ stats, columns = 2 }: QuickStatsProps) {
  const marbleConfig = MARBLE_TEXTURES.white;

  return (
    <View style={[styles.container, columns === 3 && styles.container3Col]}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const content = (
          <LinearGradient
            colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
            locations={marbleConfig.gradientLocations}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.statCard, columns === 3 && styles.statCard3Col]}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${stat.color}20` }]}>
              <Icon size={20} color={stat.color} />
            </View>
            <Text style={styles.value}>{stat.value}</Text>
            <Text style={styles.label}>{stat.label}</Text>
          </LinearGradient>
        );

        if (stat.onPress) {
          return (
            <TouchableOpacity 
              key={`stat-${index}`}
              style={styles.statWrapper}
              onPress={stat.onPress}
              activeOpacity={0.7}
            >
              {content}
            </TouchableOpacity>
          );
        }

        return (
          <View key={`stat-${index}`} style={styles.statWrapper}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

interface QuickStatsGridProps {
  availableCruises: number;
  bookedCruises: number;
  activeOffers: number;
  totalSavings?: number;
  onCruisesPress?: () => void;
  onBookedPress?: () => void;
  onOffersPress?: () => void;
  onSavingsPress?: () => void;
}

export function QuickStatsGrid({
  availableCruises,
  bookedCruises,
  activeOffers,
  totalSavings,
  onCruisesPress,
  onBookedPress,
  onOffersPress,
  onSavingsPress,
}: QuickStatsGridProps) {
  const baseStats: QuickStatItem[] = [
    {
      label: 'Available Cruises',
      value: availableCruises,
      icon: Ship,
      color: COLORS.info,
      onPress: onCruisesPress,
    },
    {
      label: 'Booked',
      value: bookedCruises,
      icon: Bookmark,
      color: COLORS.success,
      onPress: onBookedPress,
    },
    {
      label: 'Active Offers',
      value: activeOffers,
      icon: Tag,
      color: COLORS.beigeWarm,
      onPress: onOffersPress,
    },
  ];

  if (totalSavings !== undefined) {
    baseStats.push({
      label: 'Total Savings',
      value: `$${totalSavings.toLocaleString()}`,
      icon: DollarSign,
      color: COLORS.goldAccent,
      onPress: onSavingsPress,
    });
  }

  return <QuickStats stats={baseStats} columns={totalSavings !== undefined ? 2 : 3} />;
}

interface PortfolioStatsProps {
  totalCruises: number;
  totalPoints: number;
  portfolioROI: number;
  totalSavings: number;
  onPress?: () => void;
}

export function PortfolioStats({
  totalCruises,
  totalPoints,
  portfolioROI,
  totalSavings,
  onPress,
}: PortfolioStatsProps) {
  const stats: QuickStatItem[] = [
    {
      label: 'Total Cruises',
      value: totalCruises,
      icon: Ship,
      color: COLORS.info,
    },
    {
      label: 'Total Points',
      value: totalPoints.toLocaleString(),
      icon: TrendingUp,
      color: COLORS.beigeWarm,
    },
    {
      label: 'Portfolio ROI',
      value: `${portfolioROI}%`,
      icon: Calendar,
      color: portfolioROI >= 0 ? COLORS.success : COLORS.error,
    },
    {
      label: 'Total Savings',
      value: `$${totalSavings.toLocaleString()}`,
      icon: DollarSign,
      color: COLORS.goldAccent,
    },
  ];

  const content = <QuickStats stats={stats} columns={2} />;

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
    marginBottom: SPACING.lg,
  },
  container3Col: {
    marginHorizontal: -SPACING.xs / 2,
  },
  statWrapper: {
    width: '50%',
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  statCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    ...SHADOW.md,
  },
  statCard3Col: {
    padding: SPACING.md,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  value: {
    fontSize: TYPOGRAPHY.fontSizeXXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
