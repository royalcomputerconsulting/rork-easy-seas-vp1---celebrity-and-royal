import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, ChevronRight } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, GRADIENTS } from '@/constants/theme';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TierBadgeGroup } from '@/components/ui/TierBadge';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';

import { useLoyalty } from '@/state/LoyaltyProvider';

interface ClubRoyalePointsProps {
  onPress?: () => void;
  compact?: boolean;
  showPinnacleProgress?: boolean;
}

export function ClubRoyalePoints({
  onPress,
  compact = false,
  showPinnacleProgress = true,
}: ClubRoyalePointsProps) {
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    crownAnchorPoints,
    crownAnchorLevel,
    pinnacleProgress,
    mastersProgress,
  } = useLoyalty();

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Not scheduled';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yy = String(date.getFullYear());
    return `${mm}-${dd}-${yy}`;
  };

  const pinnacleETA = pinnacleProgress.nightsToNext === 0 
    ? 'Achieved!' 
    : formatDate(pinnacleProgress.projectedDate);
  
  const mastersETA = mastersProgress.pointsToNext === 0
    ? 'Achieved!'
    : mastersProgress.projectedDate
    ? formatDate(mastersProgress.projectedDate)
    : 'Play more to estimate';

  const signatureThreshold = CLUB_ROYALE_TIERS.Signature.threshold;
  const mastersThreshold = CLUB_ROYALE_TIERS.Masters.threshold;
  
  // Only show Signature progress if user has exceeded the Signature threshold (25,001+)
  const hasAchievedSignature = clubRoyalePoints >= signatureThreshold;
  // Calculate actual progress to Signature for users who haven't achieved it yet
  const primeThreshold = CLUB_ROYALE_TIERS.Prime.threshold;
  const signatureProgress = hasAchievedSignature 
    ? 100 
    : Math.min(100, Math.max(0, ((clubRoyalePoints - primeThreshold) / (signatureThreshold - primeThreshold)) * 100));
  
  const content = (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <LinearGradient
        colors={GRADIENTS.nauticalCard as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Crown size={20} color={COLORS.gold} />
          </View>
          <View>
            <Text style={styles.title}>Player & Loyalty Status</Text>
            <Text style={styles.pointsText}>
              {clubRoyalePoints.toLocaleString()} CR pts • {crownAnchorPoints} C&A pts
            </Text>
          </View>
        </View>
        
        <TierBadgeGroup 
          clubRoyaleTier={clubRoyaleTier}
          crownAnchorLevel={crownAnchorLevel}
          size="small"
        />
      </View>

      {!compact && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pinnacleProgress.nightsToNext}</Text>
              <Text style={styles.statLabel}>Nights to Pinnacle</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {mastersProgress.pointsToNext.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Points to Masters</Text>
            </View>
          </View>

          {showPinnacleProgress && (
            <View style={styles.progressSection}>
              <ProgressBar
                label={`Progress to Pinnacle (${crownAnchorPoints}/700)`}
                progress={pinnacleProgress.percentComplete}
                eta={pinnacleETA}
                height={6}
                gradientColors={[COLORS.points, COLORS.pointsLight]}
              />
              {pinnacleProgress.pinnacleShip && pinnacleProgress.pinnacleSailDate && pinnacleProgress.nightsToNext > 0 && (
                <View style={styles.pinnacleAchievementBadge}>
                  <Text style={styles.pinnacleAchievementText}>
                    ⭐ {pinnacleProgress.pinnacleShip} - {String(pinnacleProgress.pinnacleSailDate || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) ? (() => {
                      const m = String(pinnacleProgress.pinnacleSailDate).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                      if (!m) return pinnacleProgress.pinnacleSailDate;
                      const [, y, mo, da] = m;
                      return `${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}-${y}`;
                    })() : pinnacleProgress.pinnacleSailDate}
                  </Text>
                </View>
              )}
              
              <View style={styles.progressSpacer} />
              
              {hasAchievedSignature ? (
                <>
                  <ProgressBar
                    label={`Progress to Signature (${clubRoyalePoints.toLocaleString()}/${signatureThreshold.toLocaleString()}) ✓`}
                    progress={100}
                    eta="ACHIEVED!"
                    height={6}
                    gradientColors={[
                      COLORS.loyalty,
                      COLORS.loyaltyLight
                    ]}
                  />
                  
                  <View style={styles.progressSpacer} />
                  
                  <ProgressBar
                    label={`Progress to Masters (${clubRoyalePoints.toLocaleString()}/${mastersThreshold.toLocaleString()})`}
                    progress={mastersProgress.percentComplete}
                    eta={mastersETA}
                    height={6}
                    gradientColors={[
                      COLORS.gold,
                      COLORS.goldLight
                    ]}
                  />
                </>
              ) : clubRoyalePoints > primeThreshold ? (
                <ProgressBar
                  label={`Progress to Signature (${clubRoyalePoints.toLocaleString()}/${signatureThreshold.toLocaleString()})`}
                  progress={signatureProgress}
                  eta={signatureProgress < 100 ? 'In Progress' : 'Almost There!'}
                  height={6}
                  gradientColors={[
                    CLUB_ROYALE_TIERS.Signature.color,
                    '#A78BFA'
                  ]}
                />
              ) : null}
            </View>
          )}
        </>
      )}

      {onPress && (
        <View style={styles.chevron}>
          <ChevronRight size={20} color={COLORS.textSecondary} />
        </View>
      )}
    </View>
  );

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
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOW.lg,
  },
  containerCompact: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  pointsText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    color: COLORS.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: SPACING.md,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeXXL,
    color: COLORS.beigeWarm,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  progressSection: {
    marginTop: SPACING.sm,
  },
  progressSpacer: {
    height: SPACING.md,
  },
  chevron: {
    position: 'absolute',
    right: SPACING.md,
    top: '50%',
    marginTop: -10,
  },
  pinnacleAchievementBadge: {
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  pinnacleAchievementText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.gold,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    textAlign: 'center',
  },
});
