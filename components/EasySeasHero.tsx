import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Bell } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, GRADIENTS } from '@/constants/theme';
import { TierBadgeGroup } from '@/components/ui/TierBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { useLoyalty } from '@/state/LoyaltyProvider';

interface EasySeasHeroProps {
  memberName?: string;
  onSettingsPress?: () => void;
  onAlertsPress?: () => void;
  alertCount?: number;
  availableCruises?: number;
  bookedCruises?: number;
  activeOffers?: number;
  onCruisesPress?: () => void;
  onBookedPress?: () => void;
  onOffersPress?: () => void;
}

export function EasySeasHero({
  memberName = 'Player',
  onSettingsPress,
  onAlertsPress,
  alertCount = 0,
  availableCruises = 0,
  bookedCruises = 0,
  activeOffers = 0,
  onCruisesPress,
  onBookedPress,
  onOffersPress,
}: EasySeasHeroProps) {
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    crownAnchorPoints,
    crownAnchorLevel,
    clubRoyaleProgress,
    pinnacleProgress,
  } = useLoyalty();

  const formatETA = (unitsToNext: number, averagePerMonth: number): string => {
    if (unitsToNext <= 0) return 'Achieved!';
    const monthsNeeded = Math.ceil(unitsToNext / averagePerMonth);
    const eta = new Date();
    eta.setMonth(eta.getMonth() + monthsNeeded);
    return eta.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={GRADIENTS.nauticalCard as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.topRow}>
        <View style={styles.brandingSection}>
          <View style={styles.logoContainer}>
            <Image 
              source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/drzllmgo03ok1wemgb3s9' }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.appTitle}>Easy Seas</Text>
            <Text style={styles.appSubtitle}>Manage your Nautical Lifestyle</Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          {onAlertsPress && (
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={onAlertsPress}
              activeOpacity={0.7}
            >
              <Bell size={18} color={COLORS.textDarkGrey} />
              {alertCount > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>
                    {alertCount > 9 ? '9+' : alertCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {onSettingsPress && (
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={onSettingsPress}
              activeOpacity={0.7}
            >
              <Settings size={18} color={COLORS.textDarkGrey} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tierSection}>
        <TierBadgeGroup 
          clubRoyaleTier={clubRoyaleTier}
          crownAnchorLevel={crownAnchorLevel}
          size="small"
        />
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressItem}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Pinnacle ({crownAnchorPoints}/700)</Text>
            <Text style={styles.progressPercent}>{pinnacleProgress.percentComplete.toFixed(1)}%</Text>
          </View>
          <ProgressBar
            progress={pinnacleProgress.percentComplete}
            eta={`ETA: ${formatETA(pinnacleProgress.nightsToNext, 7)} • ${pinnacleProgress.nightsToNext} nights`}
            height={8}
            gradientColors={[COLORS.points, COLORS.pointsLight]}
          />
        </View>
        
        <View style={styles.progressItem}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>
              {clubRoyaleProgress.nextTier 
                ? `${clubRoyaleProgress.nextTier} (${clubRoyalePoints.toLocaleString()}/${CLUB_ROYALE_TIERS[clubRoyaleProgress.nextTier]?.threshold.toLocaleString() || 'Max'})`
                : `Masters (${clubRoyalePoints.toLocaleString()} points)`
              }
            </Text>
            <Text style={[styles.progressPercent, { color: COLORS.loyalty }]}>{clubRoyaleProgress.percentComplete.toFixed(1)}%</Text>
          </View>
          <ProgressBar
            progress={clubRoyaleProgress.percentComplete}
            eta={`ETA: ${formatETA(clubRoyaleProgress.pointsToNext, 1000)} • Resets April 1`}
            height={8}
            gradientColors={[
              clubRoyaleProgress.nextTier 
                ? CLUB_ROYALE_TIERS[clubRoyaleProgress.nextTier]?.color || COLORS.loyalty
                : CLUB_ROYALE_TIERS.Masters.color,
              COLORS.gold
            ]}
          />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.points }]}>{clubRoyalePoints.toLocaleString()}</Text>
          <Text style={styles.statLabel}>CR Points</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.loyalty }]}>{crownAnchorPoints}</Text>
          <Text style={styles.statLabel}>C&A</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={onCruisesPress} activeOpacity={0.7}>
          <Text style={styles.statValue}>{availableCruises.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={onBookedPress} activeOpacity={0.7}>
          <Text style={[styles.statValue, { color: COLORS.money }]}>{bookedCruises}</Text>
          <Text style={styles.statLabel}>Booked</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={onOffersPress} activeOpacity={0.7}>
          <Text style={styles.statValue}>{activeOffers}</Text>
          <Text style={styles.statLabel}>Offers</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  brandingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    marginRight: SPACING.sm,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
  },
  titleContainer: {
    flex: 1,
  },
  appTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textNavy,
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...SHADOW.sm,
  },
  alertBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  alertBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  tierSection: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  progressSection: {
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  progressItem: {},
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  progressPercent: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.points,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.borderLight,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textNavy,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textDarkGrey,
    marginTop: 2,
    textAlign: 'center',
  },
});
