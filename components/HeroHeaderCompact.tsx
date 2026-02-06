import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Star } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { formatNumber } from '@/lib/format';

interface HeroHeaderCompactProps {
  memberName?: string;
  tier?: string;
  tierPoints?: number;
  totalOffers?: number;
}

const TIER_COLORS: Record<string, string> = {
  'Classic': '#C0C0C0',
  'Select': '#4169E1',
  'Elite': '#9370DB',
  'Elite Plus': '#FFD700',
  'Prime': '#FF6B6B',
  'Pinnacle': '#E5E4E2',
};

export function HeroHeaderCompact({
  memberName = 'Club Member',
  tier = 'Classic',
  tierPoints = 0,
  totalOffers = 0,
}: HeroHeaderCompactProps) {
  const tierColor = TIER_COLORS[tier] || COLORS.beigeWarm;

  return (
    <LinearGradient
      colors={['rgba(0, 31, 63, 0.95)', 'rgba(0, 61, 92, 0.9)']}
      style={styles.container}
    >
      <View style={styles.topRow}>
        <View style={styles.welcomeSection}>
          <View style={styles.iconContainer}>
            <Image 
              source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/drzllmgo03ok1wemgb3s9' }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.welcomeText}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.memberName} numberOfLines={1}>{memberName}</Text>
          </View>
        </View>

        <View style={[styles.tierBadge, { borderColor: tierColor }]}>
          <Crown size={14} color={tierColor} />
          <Text style={[styles.tierText, { color: tierColor }]}>{tier}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Star size={16} color={COLORS.beigeWarm} />
          <Text style={styles.statValue}>{formatNumber(tierPoints)}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <View style={styles.offersBadge}>
            <Text style={styles.offersValue}>{totalOffers}</Text>
          </View>
          <Text style={styles.statLabel}>Active Offers</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.3)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  welcomeText: {
    flex: 1,
  },
  greeting: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  memberName: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textPrimary,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    gap: 6,
  },
  tierText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(212, 165, 116, 0.3)',
    marginHorizontal: SPACING.md,
  },
  offersBadge: {
    backgroundColor: COLORS.beigeWarm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  offersValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
});
